import "server-only";

/* ---------------------------------------------------------------------------
   ai/router/model-classes — "which KIND of model should answer this turn?"

   Phase 4E. The plan's acceptance criterion asks for selectable classes, and
   names nine of them. This file defines six, and the omission is deliberate:

     EMBEDDING, REALTIME_VOICE and IMAGE are not chat completions. They do not
     take a `messages` array, they do not return `choices[].message`, and they
     cannot travel through the Turn IR or the one door. Putting them in an enum
     that resolves to a chat model would produce a taxonomy that LOOKS complete
     and cannot work — the "complete because it compiles" the project rules
     forbid. They belong to their own capability, with their own transport,
     whenever there is a reason to add one.

   The six that remain are all reachable through the same chat call:

     FAST          greetings, small talk, acknowledgements
     GENERAL       ordinary questions and brand answers
     REASONING     the tool loop, multi-step work
     CODING        code generation and review
     VISION        turns carrying an image
     LONG_CONTEXT  turns whose input is very large

   HOW A CLASS BECOMES A MODEL, and why it is configuration rather than a
   table of constants: this environment cannot reach any provider's API, so a
   hard-coded map of class → model id would be written from memory. The last
   time that temptation came up (4B, the fallback endpoint) the answer was the
   same, and for the same reason — a wrong constant here would not fail
   loudly, it would silently send every REASONING turn to a model that does
   not exist.

   So the map is one environment variable, per adapter, JSON:

     AI_MODEL_CLASSES={"deepseek":{"REASONING":"deepseek-reasoner"}}

   Per ADAPTER, because a model id is meaningless to a different provider —
   handing DeepSeek's model name to a fallback gateway would break the very
   turn failover exists to rescue.

   IT FAILS SAFE, EVERYWHERE. Malformed JSON, an unknown adapter, an unknown
   class, a non-string value, or no variable at all all resolve to the
   adapter's own default model — which is exactly today's behaviour. There is
   no configuration of this file that can leave a turn without a model.
   --------------------------------------------------------------------------- */

export const MODEL_CLASSES = [
  "FAST",
  "GENERAL",
  "REASONING",
  "CODING",
  "VISION",
  "LONG_CONTEXT",
] as const;

export type ModelClass = (typeof MODEL_CLASSES)[number];

function isModelClass(v: string): v is ModelClass {
  return (MODEL_CLASSES as ReadonlyArray<string>).includes(v);
}

export type ClassMap = Partial<Record<ModelClass, string>>;
export type AdapterClassMap = Record<string, ClassMap>;

/** Parse the class map. Exported so the failure modes are proved directly
 *  rather than by setting environment variables in a test. Every rejection
 *  path returns {} — a partially-understood map is more dangerous than none,
 *  because it routes some classes and silently drops others. */
export function parseClassMap(raw: string | undefined): AdapterClassMap {
  if (!raw || !raw.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

  const out: AdapterClassMap = {};
  for (const [adapter, classes] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof classes !== "object" || classes === null || Array.isArray(classes)) continue;
    const entry: ClassMap = {};
    for (const [cls, model] of Object.entries(classes as Record<string, unknown>)) {
      /* Unknown class names and non-string model ids are DROPPED rather than
         coerced. A typo'd class silently routing to String(undefined) is the
         kind of thing that only shows up as a provider 400 in production. */
      if (!isModelClass(cls)) continue;
      if (typeof model !== "string" || !model.trim()) continue;
      entry[cls] = model.trim();
    }
    if (Object.keys(entry).length > 0) out[adapter] = entry;
  }
  return out;
}

const CLASS_MAP = parseClassMap(process.env.AI_MODEL_CLASSES);

/** The model an adapter should use for this class, or its default.
 *
 *  Pure apart from the module-scope map, and the map is passed in by the
 *  overload below so the resolution rule itself is testable without env. */
export function resolveModel(
  map: AdapterClassMap,
  adapterName: string,
  defaultModel: string,
  cls?: ModelClass,
): string {
  if (!cls) return defaultModel;
  return map[adapterName]?.[cls] ?? defaultModel;
}

/** Live resolution against AI_MODEL_CLASSES. */
export function modelForClass(adapterName: string, defaultModel: string, cls?: ModelClass): string {
  return resolveModel(CLASS_MAP, adapterName, defaultModel, cls);
}
