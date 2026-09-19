/* Dev-server launcher for the Hub.
 *
 * THE PORT COMES FROM THE ENVIRONMENT, NOT FROM THIS FILE.
 *
 * It used to be hardcoded `--port 3001`, which broke two things at once:
 * launch.json's `autoPort` had nothing to act on, and two Claude sessions
 * sharing this working tree could not both run a dev server — the second
 * one died with EADDRINUSE and the first one's server had to be killed to
 * make room. Reading PORT lets the harness hand out a free port and lets
 * both sessions coexist; 3001 stays the default so nothing that expects it
 * changes behaviour.
 *
 * `execSync` was imported and never used — removed.
 */
const { spawn } = require("child_process");
const path = require("path");

const ROOT = "/Users/kamalshafei/Desktop/Koleex HUB";
const NODE_BIN = "/Users/kamalshafei/.nvm/versions/node/v24.14.1/bin";
const port = process.env.PORT || "3001";

process.chdir(ROOT);

const child = spawn(
  path.join(NODE_BIN, "npx"),
  ["next", "dev", "--port", port],
  {
    stdio: "inherit",
    env: { ...process.env, PATH: `${NODE_BIN}:${process.env.PATH}` },
  },
);

/* Without this the launcher exits 0 while Next is still starting, which the
   harness reads as "the server exited during startup". */
child.on("exit", (code) => process.exit(code ?? 0));
