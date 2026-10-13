import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopTribullBackend } from "./tribull-port.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await stopTribullBackend();

const nodeModules = path.join(projectRoot, "node_modules");
const children = [
  spawn(process.execPath, [`${nodeModules}/tsx/dist/cli.mjs`, "backend/index.ts"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  }),
  spawn(process.execPath, [`${nodeModules}/vite/bin/vite.js`, "--host"], {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  }),
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
