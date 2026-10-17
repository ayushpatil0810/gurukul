module.exports = {
  apps: [
    {
      name: "gurukul-web",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "gurukul-telemetry",
      script: "server/telemetry.ts",
      interpreter: "bun",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        TELEMETRY_PORT: 3001,
      },
    },
    {
      name: "gurukul-worker",
      script: "worker/main.ts",
      interpreter: "bun",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
