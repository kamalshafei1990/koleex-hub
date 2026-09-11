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

   A SAVED LINE THAT CHANGES IS CORRECTED, NOT WRITTEN AGAIN (a call,
   2026-09-11 17:32 UTC). The socket lane's vendor transcribes a caller's
   turn several times over, settled each time, under one item; the fold
   (events.ts) now replaces the line in place. But the first hearing had
   already been posted — "قوللي الـ..." was a row before "قوللي الااا
   التوداي..." arrived — so a line that was written and then changed is
   PATCHED by the id the server gave it. Corrections go after inserts, one
   at a time, and a correction the server refuses is dropped rather than
   retried for ever. */

import { type TranscriptLine } from "./events";
import { photosMarkdown, imageUrlsIn } from "./photos";

export const TRANSCRIPT_PATH = "/api/ai/voice/transcript";
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
  /** A row the server corrected, so the thread can show the new words. */
  onUpdated?: (row: SavedTurn) => void;
  /** Returns the conversation to write into, creating one if the call began
   *  on an empty screen. Null means none could be made; the turns wait. */
  ensureConversation: () => Promise<string | null>;
  /** The rows the server wrote, so the thread can show them at once. */
  onSaved?: (rows: SavedTurn[], conversation: { id: string; title: string | null }) => void;
  onError?: (reason: PersistFailure) => void;
};

type Turn = { role: "user" | "assistant"; text: string; via: "voice" | "text" };
/** What was written for a line, by its index: the words the server holds,
 *  the row's id once the echo names it, and newer words waiting to go. */
type Written = { text: string; id: string | null; dirty: string | null };

export class TranscriptPersister {
  private settledCount = 0;
  private queue: Array<Turn & { index: number }> = [];
  private written: Array<Written | null> = [];
  private inflight: Promise<void> | null = null;
  private failures = 0;
  private dead = false;
  /* Whether the last post landed. A failed one is NOT retried immediately:
     the retry waits for the next settled turn or for hang-up, so a server
     having a bad moment sees one request per turn, not three in a burst. */
  private lastPostOk = true;

  /** `initialSettled` — how many lines of the list handed to observe() are
   *  already written. A call that RESUMES after a drop keeps its captions
   *  and gets a new persister; counting from zero re-posted the whole call
   *  so far on every resume and every voice switch (audit, 2026-09-07). */
  constructor(private readonly deps: PersistDeps, private conversationId: string | null, initialSettled = 0) {
    this.settledCount = Math.max(0, Math.floor(initialSettled));
  }

  /** How many turns are waiting to be written. For the suite. */
  pending(): number {
    return this.queue.length;
  }

  /** How many saved lines hold newer words than the server. For the suite. */
  corrections(): number {
    let n = 0;
    for (const w of this.written) if (w && w.dirty !== null) n++;
    return n;
  }

  /** The text a line is saved as: the words, and for an answer the pictures
   *  its lookup returned that the words do not already show. */
  private textOf(line: TranscriptLine): string {
    const spoken = line.text.trim();
    const already = imageUrlsIn(spoken);
    const pictures = line.role === "assistant" ? photosMarkdown((line.photos ?? []).filter((p) => !already.has(p.url))) : "";
    return pictures ? (spoken ? `${spoken}\n\n${pictures}` : pictures) : spoken;
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
    /* SETTLED MEANS EVERY LINE UP TO THE FIRST OPEN ONE. The open turn is
       not always the last line — the far side opens its answer on top of the
       caller's still-open question — and "everything but the last line"
       once posted an unfinished question and an unfinished answer as turns
       (audit, 2026-09-07). */
    /* AND A LINE LEFT OPEN BEHIND THE CONVERSATION IS SETTLED TOO. A turn
       the far side never closed — an answer cut off by a lookup or by the
       caller speaking over it, with no `done` event after — sat open for
       the rest of the call, and "everything up to the first open line"
       then stopped there: every later turn was shown and NONE was saved
       (owner, 2026-09-07: the thread after a call "not complete"; the
       rows end at the question before the picture). appendTranscript
       only ever touches the last two lines, so a line older than that
       can never change again: it is written as it stands. */
    let settled = lines.length;
    for (let i = Math.max(this.settledCount, lines.length - 2); i < lines.length; i++) {
      if (!lines[i].final) {
        settled = i;
        break;
      }
    }
    for (let i = this.settledCount; i < settled; i++) {
      const line = lines[i];
      /* THE PHOTOS GO WITH THE ANSWER. An assistant turn that showed a product
         is saved with the same picture, as markdown the bubble already
         renders — so the thread after a call looks like the thread after a
         typed question about the same machine. Only assistant turns: a user
         does not "show" anything. NOT TWICE: what the words already show as
         markdown is not appended (textOf). */
      const text = this.textOf(line);
      /* An empty final — a turn the vendor closed with no words — is counted
         as seen and not sent: the route refuses empty content, rightly. */
      this.written[i] = text ? { text, id: null, dirty: null } : null;
      if (text) this.queue.push({ role: line.role, text, via: line.via ?? "voice", index: i });
    }
    if (settled > this.settledCount) this.settledCount = settled;
    /* A LINE ALREADY WRITTEN THAT READS DIFFERENTLY NOW — the same turn,
       heard again (events.ts, the item rule) — is corrected, once its row
       has an id. Only lines this persister wrote: the ones a resume seeded
       as already settled belong to the writer before it. */
    for (let i = 0; i < Math.min(this.settledCount, lines.length, this.written.length); i++) {
      const w = this.written[i];
      if (!w) continue;
      const text = this.textOf(lines[i]);
      if (!text || text === w.text) {
        w.dirty = null;
        continue;
      }
      w.dirty = text;
    }
    void this.flush();
  }

  /** The first saved line with newer words and a row to put them in. */
  private nextCorrection(): Written | null {
    for (const w of this.written) if (w && w.dirty !== null && w.id) return w;
    return null;
  }

  /** Send what is queued. One request at a time, in order. */
  flush(keepalive = false): Promise<void> {
    if (this.inflight) return this.inflight;
    if (this.dead) return Promise.resolve();
    /* Inserts first — a correction needs the id an insert's echo brings. */
    const correction = this.queue.length === 0 ? this.nextCorrection() : null;
    if (this.queue.length === 0 && !correction) return Promise.resolve();
    this.inflight = (correction ? this.patch(correction, keepalive) : this.post(keepalive)).finally(() => {
      this.inflight = null;
      /* More may have settled while that was in flight. Only after a success:
         see lastPostOk. */
      if (!this.dead && this.lastPostOk && (this.queue.length > 0 || this.nextCorrection())) void this.flush(keepalive);
    });
    return this.inflight;
  }

  /** The call is over. Flush with `keepalive` so the request survives the
   *  screen closing — hang-up is exactly when the last turn is still queued. */
  async finish(): Promise<void> {
    /* DRAINED, NOT JUST FLUSHED. flush() returns the batch in flight, and
       the remainder was posted afterwards in its finally — so the caller
       asking for the end-of-call summary right after finish() had the last
       batch still on its way (audit, 2026-09-07). */
    while (!this.dead && (this.inflight || this.queue.length > 0 || this.nextCorrection())) {
      await this.flush(true);
      if (!this.lastPostOk) break;
    }
  }

  /** One correction: the row's new words, by its id, into the same
   *  conversation. A refusal the server would repeat (400, 404) drops the
   *  correction; anything else is tried again with the next turn. */
  private async patch(w: Written, keepalive: boolean): Promise<void> {
    const text = w.dirty;
    if (!this.conversationId || !w.id || text === null) return;
    let res: Response;
    try {
      res = await this.deps.fetchFn(TRANSCRIPT_PATH, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: this.conversationId, message_id: w.id, text }),
        keepalive,
      });
    } catch {
      this.noteFailure();
      return;
    }
    if (res.ok) {
      this.failures = 0;
      this.lastPostOk = true;
      w.text = text;
      /* Newer words may have landed while this was in flight; they stay
         dirty and go next. */
      if (w.dirty === text) w.dirty = null;
      try {
        const body = (await res.json()) as { message?: SavedTurn };
        if (body.message && typeof body.message === "object") this.deps.onUpdated?.(body.message);
      } catch {
        /* Written; the thread catches up on its next load. */
      }
      return;
    }
    if (res.status === 401 || res.status === 403) return this.giveUp("unauthorised");
    if (res.status === 404 || res.status === 400) {
      w.dirty = null;
      return;
    }
    this.noteFailure();
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
        body: JSON.stringify({ conversation_id: this.conversationId, turns: batch.map(({ role, text, via }) => ({ role, text, via })) }),
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
          /* THE ROWS COME BACK IN THE ORDER SENT; each id is the handle a
             later correction of that line needs. A short echo names none. */
          if (body.messages.length === batch.length) {
            body.messages.forEach((row, k) => {
              const w = this.written[batch[k].index];
              if (w && row && typeof row.id === "string") w.id = row.id;
            });
          }
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
