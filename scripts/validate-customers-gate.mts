#!/usr/bin/env node
/* validate:customers-gate — precedence for the Wave 2A.1 Customers rollout gate.
   Order: ?serverlist=0 → legacy · ?serverlist=1 → server · cohort → server ·
   Preview host → server · production → legacy. Pure unit test. */
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
check("preview host, no cohort → server-list", shouldUseServerList(PREVIEW, "", false) === true);
check("preview host, ?serverlist=0 → legacy", shouldUseServerList(PREVIEW, "?serverlist=0", false) === false);
check("koleexgroup subdomain, no cohort → legacy", shouldUseServerList("app.koleexgroup.com", "", false) === false);
check("localhost, no cohort → server-list", shouldUseServerList("localhost", "", false) === true);
check("empty search safe", shouldUseServerList(PROD, "", false) === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
