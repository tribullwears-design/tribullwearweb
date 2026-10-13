import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stopTribullBackend } from "./tribull-port.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendEntry = path.join(projectRoot, "dist", "index.js");
await stopTribullBackend();

const backend = spawn(process.execPath, [backendEntry], {
  cwd: projectRoot,
  env: { ...process.env, NODE_ENV: "production" },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (backend.pid) process.kill(backend.pid, signal);
  });
}

backend.on("error", (error) => {
  console.error("Failed to start the production backend:", error);
  process.exitCode = 1;
});
backend.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
