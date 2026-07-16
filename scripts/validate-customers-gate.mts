#!/usr/bin/env node
/* validate:customers-gate — the Wave 2A.1 Customers preview gate must keep
   PRODUCTION on the legacy UI and only enable server-list mode on preview
   hosts (or explicit override). Pure unit test. */
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { shouldUseServerList } = await import(path.resolve(__dirname, "../src/lib/server-list/customers-gate.ts")) as typeof import("../src/lib/server-list/customers-gate.js");

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("  ✓ " + n)) : (fail++, console.error("  ✗ " + n)); };

check("production host → legacy", shouldUseServerList("hub.koleexgroup.com", "") === false);
check("any koleexgroup.com subdomain → legacy", shouldUseServerList("app.koleexgroup.com", "") === false);
check("vercel preview host → server-list", shouldUseServerList("koleex-hub-git-wave2a1-x.vercel.app", "") === true);
check("localhost → server-list", shouldUseServerList("localhost", "") === true);
check("prod host + ?serverlist=1 override → server-list", shouldUseServerList("hub.koleexgroup.com", "?serverlist=1") === true);
check("preview host + ?serverlist=0 override → legacy", shouldUseServerList("x.vercel.app", "?serverlist=0") === false);
check("empty search safe", shouldUseServerList("hub.koleexgroup.com", "") === false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
