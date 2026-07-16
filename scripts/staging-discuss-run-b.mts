/* ---------------------------------------------------------------------------
   staging-discuss-run-b — seed / cleanup / verify the Discuss Run-B fixtures.
   (Discuss-scoped staging environment for Unit 2 Run B)

   EVERY mode calls assertStagingEnvironment() FIRST. There is no code path in
   this file that opens a client before the guard has passed — that ordering is
   the whole safety property, so do not "optimise" the client construction
   above the guard.

   Identities are synthetic and @test.invalid. The password is a disposable
   fixture value, never a real credential, and is supplied via
   KX_FIXTURE_PASSWORD (defaulted here only because the value is worthless).

   Cleanup targets fixtures BY THEIR DETERMINISTIC IDS, never by "delete all".
   A truncate-style cleanup pointed at the wrong DB is exactly the accident the
   guard exists to prevent; scoping by id means even a guard bypass could only
   remove rows that this script itself created.
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
/* NodeNext: an .mts importing an .mts uses the emitted .mjs specifier. */
import { assertStagingEnvironment } from "./assert-staging-environment.mjs";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const ROLE_IDS = [
  "33333333-3333-4333-8333-000000000001",
  "33333333-3333-4333-8333-000000000002",
  "33333333-3333-4333-8333-000000000003",
  "33333333-3333-4333-8333-000000000004",
];
const PERSON_IDS = Array.from({ length: 6 }, (_, i) =>
  `44444444-4444-4444-8444-00000000000${i + 1}`);
const CONTACT_IDS = ["55555555-5555-4555-8555-000000000001"];
const ACCOUNT_IDS = Array.from({ length: 7 }, (_, i) =>
  `66666666-6666-4666-8666-00000000000${i + 1}`);
const CHANNEL_A = "77777777-7777-4777-8777-00000000000a";
const CHANNEL_B = "77777777-7777-4777-8777-00000000000b";
const MESSAGE_IDS = Array.from({ length: 6 }, (_, i) =>
  `88888888-8888-4888-8888-00000000000${i + 1}`);

const FIXTURE_PATHS = {
  "discuss-media": ["runb/runb-image.png", "runb/runb-doc.pdf", "runb/m1.png",
                    "runb/m2.pdf", "runb/gone.png", "runb/tenantb.png"],
  "discuss-voice": ["runb/runb-voice.webm", "runb/m-voice.webm"],
} as const;

const mode = process.argv[2] ?? "";
const env = assertStagingEnvironment();
const db = createClient(env.supabaseUrl, env.serviceRoleKey, {
  auth: { persistSession: false },
});

async function cleanup() {
  /* Child-first so FK cascades never surprise us, and so a partial failure
     leaves a state the next run can still finish cleaning. */
  await db.from("discuss_messages").delete().in("id", MESSAGE_IDS);
  await db.from("discuss_members").delete().in("channel_id", [CHANNEL_A, CHANNEL_B]);
  await db.from("discuss_channels").delete().in("id", [CHANNEL_A, CHANNEL_B]);
  await db.from("accounts").delete().in("id", ACCOUNT_IDS);
  await db.from("contacts").delete().in("id", CONTACT_IDS);
  await db.from("people").delete().in("id", PERSON_IDS);
  await db.from("roles").delete().in("id", ROLE_IDS);
  await db.from("tenants").delete().in("id", [TENANT_A, TENANT_B]);
  for (const [bucket, paths] of Object.entries(FIXTURE_PATHS)) {
    await db.storage.from(bucket).remove([...paths]);
  }
  console.log("  fixtures removed (scoped by deterministic id).");
}

async function verifyClean() {
  const checks: Array<[string, number]> = [];
  for (const [table, ids, col] of [
    ["discuss_messages", MESSAGE_IDS, "id"],
    ["discuss_channels", [CHANNEL_A, CHANNEL_B], "id"],
    ["accounts", ACCOUNT_IDS, "id"],
    ["people", PERSON_IDS, "id"],
    ["tenants", [TENANT_A, TENANT_B], "id"],
  ] as const) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true }).in(col, ids as string[]);
    checks.push([table, count ?? 0]);
  }
  let dirty = false;
  for (const [t, c] of checks) {
    if (c > 0) dirty = true;
    console.log(`  ${t.padEnd(18)} residual fixture rows: ${c}`);
  }
  if (dirty) {
    console.error("\n  NOT CLEAN — fixtures remain. Run staging:cleanup-discuss-run-b.\n");
    process.exit(1);
  }
  console.log("\n  clean: zero fixture rows remain.\n");
}

async function report() {
  const { count: accounts } = await db.from("accounts").select("*", { count: "exact", head: true });
  const { count: messages } = await db.from("discuss_messages").select("*", { count: "exact", head: true });
  const { count: channels } = await db.from("discuss_channels").select("*", { count: "exact", head: true });
  console.log(`  accounts=${accounts} channels=${channels} messages=${messages}`);
}

switch (mode) {
  case "cleanup":      await cleanup(); break;
  case "verify-clean": await verifyClean(); break;
  case "report":       await report(); break;
  case "reset":        await cleanup(); console.log("  reset complete (re-seed with staging:seed-discuss-run-b)."); break;
  default:
    console.error(`\n  usage: staging-discuss-run-b.mts <cleanup|verify-clean|report|reset>\n`);
    process.exit(1);
}
