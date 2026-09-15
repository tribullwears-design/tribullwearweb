import { spawn } from "node:child_process";

const nodeModules = "node_modules";
const children = [
  spawn(process.execPath, [`${nodeModules}/tsx/dist/cli.mjs`, "backend/index.ts"], { stdio: "inherit", env: process.env }),
  spawn(process.execPath, [`${nodeModules}/vite/bin/vite.js`, "--host"], { stdio: "inherit", env: process.env }),
];

const shutdown = () => {
  for (const child of children) child.kill();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

for (const child of children) {
  child.on("exit", (code) => {
    if (code && code !== 0) process.exitCode = code;
  });
}
