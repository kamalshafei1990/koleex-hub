/* ---------------------------------------------------------------------------
   voice/persist — spoken turns become messages in the conversation.

   WHAT WAS WRONG. A call's words lived on the call screen and died with it.
   VoiceTranscript's own header said so — "voice turns are NOT persisted" —
   and drew the honest conclusion that captions must not look like messages.
   The owner's ask is the other resolution: make them messages. Say something
   on a call, hang up, and the exchange is in the thread you can keep typing
   in, the way it is in ChatGPT.

   WHY THE BROWSER POSTS THEM. The audio path is browser-to-vendor directly;
   the server never hears the call and never sees a transcript. The only party
   holding the words is this page, so this page relays them — to a route that
   authenticates, checks the conversation is the caller's, caps the size, and
   writes the rows itself. The browser never touches the database.

   WHAT THAT MEANS, SAID PLAINLY. The assistant's spoken turn arrives from the
   client too, so a client could post words the assistant never said — into
   its OWN conversation, which it could equally type into. Every row written
   this way is marked source='voice' so nothing downstream mistakes a relayed
   transcript for a server-generated answer.

   ONLY SETTLED TURNS ARE SENT. A partial caption rewrites itself word by word;
   posting those would write a turn several times. `appendTranscript` keeps at
   most one open line, always the last, so everything before it is final and
   this module only has to remember how many lines it has already queued.

   NEVER TAKES THE CALL DOWN. A failed post is retried a bounded number of
   times and then given up on with one callback; the audio continues
   regardless. Persistence is a nicety on top of a call, not a condition of it.
   --------------------------------------------------------------------------- */

import { type TranscriptLine } from "./events";
import { photosMarkdown, imageUrlsIn } from "./photos";

export const TRANSCRIPT_PATH = "/api/ai/voice/transcript";

const CJK_RE = /[\u3400-\u9FFF]/;
/** An assistant final so short it can only be the first syllable of a reply
 *  that was interrupted: at most three characters, no picture, not Chinese
 *  (where two characters are a whole answer). Pure. */
export function isCutOffFragment(role: string, spoken: string, pictures: string): boolean {
  if (role !== "assistant" || pictures) return false;
  const t = spoken.trim();
  return t.length > 0 && t.length <= 3 && !CJK_RE.test(t);
}
/** One POST carries at most this many turns; the server refuses more. */
export const MAX_TURNS_PER_POST = 20;
/** Consecutive failed posts before this module stops trying for the call. */
export const MAX_POST_FAILURES = 3;

export type SavedTurn = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  source?: string;
};

export type PersistFailure = "unauthorised" | "not-found" | "failed";

export type PersistDeps = {
  fetchFn: typeof fetch;
  /** Returns the conversation to write into, creating one if the call began
   *  on an empty screen. Null means none could be made; the turns wait. */
  ensureConversation: () => Promise<string | null>;
  /** The rows the server wrote, so the thread can show them at once. */
  onSaved?: (rows: SavedTurn[], conversation: { id: string; title: string | null }) => void;
  onError?: (reason: PersistFailure) => void;
};

type Turn = { role: "user" | "assistant"; text: string; via: "voice" | "text" };

export class TranscriptPersister {
  private settledCount = 0;
  private queue: Turn[] = [];
  private inflight: Promise<void> | null = null;
  private failures = 0;
  private dead = false;
  /* Whether the last post landed. A failed one is NOT retried immediately:
     the retry waits for the next settled turn or for hang-up, so a server
     having a bad moment sees one request per turn, not three in a burst. */
  private lastPostOk = true;

  constructor(private readonly deps: PersistDeps, private conversationId: string | null) {}

  /** How many turns are waiting to be written. For the suite. */
  pending(): number {
    return this.queue.length;
  }

  /** The conversation the turns are going into, once known. */
  conversation(): string | null {
    return this.conversationId;
  }

  /**
   * Look at the running transcript and queue whatever has settled since the
   * last look. Called on every transcript event; cheap when nothing changed.
   */
  observe(lines: readonly TranscriptLine[]): void {
    if (this.dead) return;
    const last = lines[lines.length - 1];
    const settled = last && !last.final ? lines.length - 1 : lines.length;
    for (let i = this.settledCount; i < settled; i++) {
      const line = lines[i];
      const spoken = line.text.trim();
      /* THE PHOTOS GO WITH THE ANSWER. An assistant turn that showed a product
         is saved with the same picture, as markdown the bubble already
         renders — so the thread after a call looks like the thread after a
         typed question about the same machine. Only assistant turns: a user
         does not "show" anything. */
      /* NOT TWICE. The model sometimes writes the picture into its own words
         as markdown; appending the same URL again put the same product photo
         under the answer two times. What the words already show is not
         appended. */
      const already = imageUrlsIn(spoken);
      const pictures = line.role === "assistant" ? photosMarkdown((line.photos ?? []).filter((p) => !already.has(p.url))) : "";
      const text = pictures ? (spoken ? `${spoken}\n\n${pictures}` : pictures) : spoken;
      /* An empty final — a turn the vendor closed with no words — is counted
         as seen and not sent: the route refuses empty content, rightly. */
      /* A CUT-OFF FIRST SYLLABLE IS NOT A TURN EITHER. Two saved calls
         (2026-09-04) carried assistant rows of "I", "I", "I", "خل" and "بال":
         each a reply interrupted the moment it started, closed by the vendor
         with the one token that got out. Saved, they litter the thread and
         the end-of-call summary counts them as answers. An assistant final of
         three characters or fewer, with no picture, is a fragment and is
         skipped — except in Chinese, where 好的 is a whole answer. */
      if (text && isCutOffFragment(line.role, spoken, pictures)) continue;
      if (text) this.queue.push({ role: line.role, text, via: line.via ?? "voice" });
    }
    if (settled > this.settledCount) this.settledCount = settled;
    void this.flush();
  }

  /** Send what is queued. One request at a time, in order. */
  flush(keepalive = false): Promise<void> {
    if (this.inflight) return this.inflight;
    if (this.dead || this.queue.length === 0) return Promise.resolve();
    this.inflight = this.post(keepalive).finally(() => {
      this.inflight = null;
      /* More may have settled while that was in flight. Only after a success:
         see lastPostOk. */
      if (!this.dead && this.lastPostOk && this.queue.length > 0) void this.flush(keepalive);
    });
    return this.inflight;
  }

  /** The call is over. Flush with `keepalive` so the request survives the
   *  screen closing — hang-up is exactly when the last turn is still queued. */
  finish(): Promise<void> {
    return this.flush(true);
  }

  private async post(keepalive: boolean): Promise<void> {
    if (!this.conversationId) {
      try {
        this.conversationId = await this.deps.ensureConversation();
      } catch {
        this.conversationId = null;
      }
      if (!this.conversationId) {
        this.noteFailure();
        return;
      }
    }

    const batch = this.queue.splice(0, MAX_TURNS_PER_POST);
    let res: Response;
    try {
      res = await this.deps.fetchFn(TRANSCRIPT_PATH, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: this.conversationId, turns: batch }),
        keepalive,
      });
    } catch {
      this.queue.unshift(...batch);
      this.noteFailure();
      return;
    }

    if (res.ok) {
      this.failures = 0;
      this.lastPostOk = true;
      try {
        const body = (await res.json()) as {
          messages?: SavedTurn[];
          conversation?: { id: string; title: string | null };
        };
        if (Array.isArray(body.messages) && body.conversation) {
          this.deps.onSaved?.(body.messages, body.conversation);
        }
      } catch {
        /* Written, but the echo was unreadable. The thread catches up on its
           next load; nothing to retry. */
      }
      return;
    }

    /* THE STATUSES THAT MEAN "STOP", each with its own word for the UI. A
       401 will not fix itself mid-call; a 404 means the conversation is gone
       (deleted from another tab); a 403 means voice was revoked. Retrying any
       of them is noise. */
    if (res.status === 401 || res.status === 403) return this.giveUp("unauthorised");
    if (res.status === 404) return this.giveUp("not-found");
    /* Our own input was refused — a malformed batch would be refused again
       identically, so it is dropped rather than retried. */
    if (res.status === 400) return;

    this.queue.unshift(...batch);
    this.noteFailure();
  }

  private noteFailure(): void {
    this.lastPostOk = false;
    this.failures++;
    if (this.failures >= MAX_POST_FAILURES) this.giveUp("failed");
  }

  private giveUp(reason: PersistFailure): void {
    this.dead = true;
    this.queue = [];
    this.deps.onError?.(reason);
  }
}
