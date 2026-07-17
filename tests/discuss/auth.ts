/* kxperf browser rig — ephemeral fixture authentication.
   ────────────────────────────────────────────────────────────────────────────
   The fixture passwords were deliberately never persisted, so this ROTATES one:
   generate a random secret, store its argon2 hash on the STAGING fixture row,
   drive the real /login form with it, and let it die with the process. The
   plaintext exists only in a local const.

   ── Why tracing is started AFTER login, not before ───────────────────────────
   Playwright's trace records every action WITH ITS ARGUMENTS. `page.fill(sel,
   secret)` therefore writes the plaintext password into trace.zip, which is an
   artifact we hand around. Same for video frames of a focused field and for
   `page.evaluate` args. Masking the DOM does not help: the leak is the action
   log, not the pixels.

   So the contract is: log in with tracing OFF, then start tracing. The login
   itself is not part of the measurement anyway — we measure /discuss, and a
   trace of a login form is worth less than the risk of shipping a credential.

   Auth is exercised, never bypassed: the real form, the real POST, the real
   argon2 verify, the real HttpOnly SameSite cookie. Nothing about the session
   contract is weakened for the benchmark. */

import type { Browser, BrowserContext, Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { assertSafe, FIXTURE_TAG, STAGING_REF } from "./guards";

/* Hash with the APP's real hashPassword — never a reimplementation.
   src/lib/server/password.ts starts with `import "server-only"`, which throws
   under Playwright's runner (no react-server condition), so it cannot be
   imported here directly. Duplicating the argon2 parameters into the test would
   remove that error at the cost of silently drifting from production the day
   someone retunes them — the test would still pass while hashing differently.
   So we shell out to a runtime that CAN import it.

   The secret goes in over stdin, not argv: argv is world-readable via `ps`. */
function hashViaApp(secret: string): string {
  const src = `
    import { hashPassword } from "./src/lib/server/password";
    let s = ""; process.stdin.on("data", (d) => (s += d));
    process.stdin.on("end", async () => {
      const h = await hashPassword(s);
      process.stdout.write(typeof h === "string" ? h : h.hash);
    });
  `;
  return execFileSync(
    process.execPath,
    ["--conditions=react-server", "--import", "tsx", "--input-type=module", "--eval", src],
    { input: secret, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] },
  ).trim();
}

export type FixtureUser = "sender" | "receiver";
const USERNAME: Record<FixtureUser, string> = {
  sender: "kxperf_sender",
  receiver: "kxperf_receiver",
};

function db() {
  const url = process.env.SUPABASE_URL!;
  if (!url.includes(STAGING_REF)) throw new Error("refusing: not the staging project");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

/** Rotate ONE fixture account's password. Returns the plaintext to the caller
 *  in memory only. Scoped by username AND fixture tag so a mistyped username
 *  cannot rotate a real account: a non-fixture row simply does not match. */
async function rotate(user: FixtureUser): Promise<{ email: string; secret: string }> {
  const secret = randomBytes(24).toString("base64url");
  const hash = hashViaApp(secret);

  /* This workstation's uplink to the Tokyo project intermittently drops TLS
     mid-request ("fetch failed"). That is a property of the laptop, not of the
     app, and it must not masquerade as a login failure — the first version of
     this rig reported exactly that and sent me looking at the receiver's
     account for a bug that did not exist. Retry the transport; never retry a
     REAL rejection (a missing fixture row still throws immediately). */
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data, error } = await db()
      .from("accounts")
      .update({ password_hash: hash, password_algo: "argon2id", force_password_change: false })
      .eq("username", USERNAME[user])
      .eq("internal_notes", FIXTURE_TAG)          // fixture rows ONLY
      .select("login_email");
    if (!error && data?.length) return { email: data[0].login_email as string, secret };
    if (!error && !data?.length)
      throw new Error(`no fixture row for ${USERNAME[user]} — refusing (did the fixture get cleaned up?)`);
    lastErr = error?.message ?? "unknown";
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(`fixture rotate failed for ${USERNAME[user]} after 4 attempts: ${lastErr}`);
}

/** A fresh isolated context per user: separate cookie jar, separate storage.
 *  Two of these run simultaneously for the sender/receiver tests. */
export async function signIn(
  browser: Browser,
  user: FixtureUser,
  opts: { baseURL: string; viewport?: { width: number; height: number }; isMobile?: boolean },
): Promise<{ context: BrowserContext; page: Page }> {
  assertSafe(process.env, opts.baseURL);

  const context = await browser.newContext({
    baseURL: opts.baseURL,
    viewport: opts.viewport,
    isMobile: opts.isMobile,
    hasTouch: opts.isMobile,
    // Video OFF for the whole context: a video of the login form is a video of
    // someone typing a password. We capture screenshots deliberately instead.
    recordVideo: undefined,
  });

  const page = await context.newPage();
  const { email, secret } = await rotate(user);

  /* /api/auth/signin is rate-limited per account/IP (src/lib/server/rate-limit).
     A benchmark logs in far more often than a human, so the rig trips that limit
     — and a throttled login looks EXACTLY like a wrong password: the form just
     stays put. That control is protecting real accounts and must not be
     weakened or bypassed for convenience, so the rig waits it out instead.
     Backoff is generous because the window is minutes, not seconds. */
  let signedIn = false;
  let lastPageError = "";
  for (let attempt = 0; attempt < 4 && !signedIn; attempt++) {
    if (attempt > 0) await page.waitForTimeout(20_000 * attempt);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(secret);   // tracing is OFF here, by contract
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });
      signedIn = true;
    } catch {
      lastPageError = (await page.locator('[role="alert"], .text-red-300').first().textContent().catch(() => "")) ?? "";
    }
  }
  if (!signedIn)
    throw new Error(
      `login did not complete for ${USERNAME[user]} after 4 attempts. Last message from the page: ` +
      `${JSON.stringify(lastPageError)}. Auth was NOT bypassed; if this says rate-limited, that is the ` +
      `app's real control working — space the runs out rather than weakening it.`,
    );

  // Prove the session is real rather than assuming the redirect meant success.
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "koleex_session");
  if (!session) throw new Error("login produced no koleex_session cookie — auth failed, and was NOT bypassed");
  if (!session.httpOnly) throw new Error("koleex_session is not HttpOnly — refusing to continue on a weakened session");
  return { context, page };
}

/** Start tracing only once credentials are out of the picture. */
export async function startTracing(context: BrowserContext, title: string) {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: false, title });
}
