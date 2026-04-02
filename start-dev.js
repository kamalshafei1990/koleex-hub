const { execSync } = require("child_process");
process.chdir("/Users/kamalshafei/Desktop/Koleex HUB");
require("child_process").spawn(
  "/Users/kamalshafei/.nvm/versions/node/v24.14.1/bin/npx",
  ["next", "dev", "--port", "3001"],
  { stdio: "inherit", env: { ...process.env, PATH: "/Users/kamalshafei/.nvm/versions/node/v24.14.1/bin:" + process.env.PATH } }
);
