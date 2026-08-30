/* ---------------------------------------------------------------------------
   ai/provider/turn-ir — the neutral representation of one model turn.

   Phase 3. Today the core speaks OpenAI's wire format directly: `tool_calls`
   with a `function.arguments` JSON string, `tool_choice` as
   `{type:"function",function:{name}}`, `role:"tool"` with `tool_call_id`.
   That format happens to be what DeepSeek accepts, so it works — but it means
   "support a second provider" reads as "rewrite the loop".

   The IR is deliberately NOT a copy of that format with different names. Where
   the wire format has an accident of history, the IR says what is meant:

     wire  tool_choice: { type: "function", function: { name: "askUser" } }
     IR    toolChoice:  { forceTool: "askUser" }

     wire  tools: [{ type: "function", function: { name, description, … } }]
     IR    tools: [{ name, description, parameters }]

   One thing IS carried over unchanged, on purpose: tool-call arguments stay a
   JSON **string** (`argumentsJson`), unparsed. A model can and does emit
   invalid JSON, and the loop has guards that depend on seeing that. An IR that
   parsed eagerly would either throw inside the transport or silently swallow a
   malformed call — both worse than handing the string on.

   No imports, no I/O, no `server-only`: this is a data shape and its
   conversions, and it is unit-tested by calling it.
   --------------------------------------------------------------------------- */

/* TYPE-ONLY, deliberately. model-classes.ts carries `import "server-only"`,
   and turn-ir does not — it is a pure conversion module that the validation
   suites import directly. A type import is erased at compile time, so this
   costs no runtime dependency and cannot pull a server-only module into a
   context that must not have one. */
import type { ModelClass } from "@/lib/server/ai/router/model-classes";

export type IrRole = "system" | "user" | "assistant" | "tool";

export interface IrToolCall {
  id: string;
  name: string;
  /** Raw JSON string as the provider emitted it. Never parsed here — see the
   *  header for why. */
  argumentsJson: string;
}

export interface IrMessage {
  role: IrRole;
  /** null is meaningful on an assistant turn that ONLY called tools. */
  content: string | null;
  /** assistant turns only */
  toolCalls?: IrToolCall[];
  /** tool results only — which call this answers */
  toolCallId?: string;
  /** tool results only — the tool's name, for providers that want it */
  name?: string;
}

export interface IrTool {
  name: string;
  description: string;
  parameters: unknown;
}

/** "auto" — the model decides. "none" — tools are withheld entirely.
 *  { forceTool } — this exact tool must be called on this request. */
export type IrToolChoice = "auto" | "none" | { forceTool: string };

export interface TurnRequest {
  messages: IrMessage[];
  /** Which KIND of model should answer. Advisory: an adapter resolves it to a
   *  concrete model id, or ignores it and uses its default. It is NOT part of
   *  the wire body — toOpenAiBody never reads it — so adding it cannot change
   *  the bytes the golden differential pins. */
  modelClass?: ModelClass;
  tools?: IrTool[];
  toolChoice?: IrToolChoice;
  maxTokens: number;
  temperature: number;
  stream?: boolean;
}

export interface TurnResponse {
  content: string;
  toolCalls: IrToolCall[];
  finishReason?: string | null;
  usage?: { inputTokens: number | null; outputTokens: number | null };
}

/* ── OpenAI-compatible conversions ──────────────────────────────────────
   DeepSeek, Groq, Qwen/DashScope, Mistral and OpenAI itself all accept this
   shape, so one adapter covers most of the field. A provider that does not
   (Anthropic, Gemini) writes its own conversions against the SAME IR — which
   is the entire point of having one.
   ───────────────────────────────────────────────────────────────────── */

export interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
  name?: string;
}

export interface OpenAiTool {
  type: "function";
  function: { name: string; description: string; parameters: unknown };
}

export type OpenAiToolChoice =
  | "auto"
  | "none"
  | { type: "function"; function: { name: string } };

export function toOpenAiMessages(messages: IrMessage[]): OpenAiMessage[] {
  return messages.map((m) => {
    const out: OpenAiMessage = { role: m.role, content: m.content };
    if (m.toolCalls?.length) {
      out.tool_calls = m.toolCalls.map((c) => ({
        id: c.id,
        type: "function" as const,
        function: { name: c.name, arguments: c.argumentsJson },
      }));
    }
    if (m.toolCallId) out.tool_call_id = m.toolCallId;
    if (m.name) out.name = m.name;
    return out;
  });
}

export function fromOpenAiMessages(messages: OpenAiMessage[]): IrMessage[] {
  return messages.map((m) => {
    const out: IrMessage = { role: m.role, content: m.content ?? null };
    if (m.tool_calls?.length) {
      out.toolCalls = m.tool_calls.map((c) => ({
        id: c.id,
        name: c.function.name,
        argumentsJson: c.function.arguments,
      }));
    }
    if (m.tool_call_id) out.toolCallId = m.tool_call_id;
    if (m.name) out.name = m.name;
    return out;
  });
}

export function toOpenAiTools(tools: IrTool[]): OpenAiTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function fromOpenAiTools(tools: OpenAiTool[]): IrTool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    parameters: t.function.parameters,
  }));
}

export function toOpenAiToolChoice(choice: IrToolChoice): OpenAiToolChoice {
  if (choice === "auto" || choice === "none") return choice;
  return { type: "function", function: { name: choice.forceTool } };
}

export function fromOpenAiToolChoice(choice: OpenAiToolChoice): IrToolChoice {
  if (choice === "auto" || choice === "none") return choice;
  return { forceTool: choice.function.name };
}

/** Build the OpenAI-compatible request body for a turn.
 *
 *  Three details here are NOT stylistic — they reproduce what
 *  core/transport.ts sends today, byte for byte, and validate:ai-turn-ir
 *  diffs the two functions over a matrix of turns to keep it that way:
 *
 *    · A turn with NO tools sends no `tools` and no `tool_choice` AT ALL.
 *      Not `tool_choice: "auto"` with an empty array. This is the small-talk
 *      and brand fast path, and the first version of this function got it
 *      wrong — it defaulted the choice to "auto" and would have started
 *      sending both keys on every fast-lane call. The differential test
 *      caught it; that is what the test is for.
 *    · `tool_choice: "none"` omits `tools` entirely rather than sending it
 *      empty.
 *    · A non-streaming call has no `stream` key, never `stream: false`.
 *
 *  So tools are emitted only when the caller actually supplied some AND did
 *  not ask for them to be withheld. */
export function toOpenAiBody(
  req: TurnRequest,
  model: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: toOpenAiMessages(req.messages),
    temperature: req.temperature,
    max_tokens: req.maxTokens,
  };
  if (req.stream) body.stream = true;
  const choice = req.toolChoice ?? "auto";
  if (req.tools !== undefined && choice !== "none") {
    body.tools = toOpenAiTools(req.tools);
    body.tool_choice = toOpenAiToolChoice(choice);
  }
  return body;
}
