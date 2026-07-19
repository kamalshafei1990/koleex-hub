#!/usr/bin/env node
/* validate:customers-gate — precedence for the Wave 2A.1 Customers rollout gate.
   Order: ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   else → legacy EVERYWHERE (owner decision 2026-07-20: previews show the same
   app as production; the pilot is opt-in only). Pure unit test. */
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { shouldUseServerList } = await import(path.resolve(__dirname, "../src/lib/server-list/customers-gate.ts")) as typeof import("../src/lib/server-list/customers-gate.js");

const PROD = "hub.koleexgroup.com";
const PREVIEW = "koleex-hub-git-x.vercel.app";
let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };
// signature: (hostname, search, inCohort)
check("prod, no cohort, no override → legacy", shouldUseServerList(PROD, "", false) === false);
check("prod, cohort → server-list", shouldUseServerList(PROD, "", true) === true);
check("prod, cohort, but ?serverlist=0 forces legacy (precedence 1)", shouldUseServerList(PROD, "?serverlist=0", true) === false);
check("prod, no cohort, ?serverlist=1 → server-list", shouldUseServerList(PROD, "?serverlist=1", false) === true);
check("prod, cohort, ?serverlist=1 → server-list", shouldUseServerList(PROD, "?serverlist=1", true) === true);
check("preview host, no cohort → legacy (matches prod)", shouldUseServerList(PREVIEW, "", false) === false);
check("preview host, ?serverlist=1 → server-list (opt-in)", shouldUseServerList(PREVIEW, "?serverlist=1", false) === true);
check("koleexgroup subdomain, no cohort → legacy", shouldUseServerList("app.koleexgroup.com", "", false) === false);
check("localhost, no cohort → legacy (matches prod)", shouldUseServerList("localhost", "", false) === false);
check("localhost, cohort → server-list", shouldUseServerList("localhost", "", true) === true);
check("empty search safe", shouldUseServerList(PROD, "", false) === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
