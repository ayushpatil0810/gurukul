const path = require("path");
const fs = require("fs");

const homeBun = path.join(process.env.HOME || "", ".bun", "bin", "bun");
const bunBin = fs.existsSync(homeBun) ? homeBun : "bun";

module.exports = {
  apps: [
    {
      name: "gurukul-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "gurukul-telemetry",
      cwd: __dirname,
      script: "server/telemetry.ts",
      interpreter: bunBin,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        TELEMETRY_PORT: 3001,
      },
    },
    {
      name: "gurukul-worker",
      cwd: __dirname,
      script: "worker/main.ts",
      interpreter: bunBin,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
