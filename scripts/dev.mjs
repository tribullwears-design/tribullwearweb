import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { belongsToTribullService, getListenerPids, getProcessTree } from "./tribull-port.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ownedChildren = new Set();
const startupTimeoutMs = 90_000;
const shutdownTimeoutMs = 5_000;
const frontendPorts = Array.from({ length: 11 }, (_, index) => 3001 + index);
let shutdownSignal;
let resolveShutdown;
const shutdownRequested = new Promise((resolve) => {
  resolveShutdown = resolve;
});

function requestShutdown(signal) {
  shutdownSignal = signal;
  resolveShutdown({ signal });
}

process.once("SIGINT", () => requestShutdown("SIGINT"));
process.once("SIGTERM", () => requestShutdown("SIGTERM"));

function shutdownError(signal = shutdownSignal) {
  const error = new Error(`Received ${signal}; stopping only child processes started by this script.`);
  error.name = "ShutdownRequestedError";
  return error;
}

function describeListener(pid, processes) {
  return processes.find((entry) => entry.pid === pid)?.commandLine || "unknown command";
}

function verifyServiceListeners(port, processes, service) {
  const pids = getListenerPids(port);
  if (pids.size === 0) return [];

  const matches = [...pids].map((pid) => ({ pid, isTribullService: belongsToTribullService(pid, processes, service) }));
  const unidentified = matches.filter((match) => !match.isTribullService);
  if (unidentified.length > 0) {
    const details = unidentified
      .map(({ pid }) => `PID ${pid}: ${describeListener(pid, processes)}`)
      .join("; ");
    throw new Error(`Port ${port} is occupied by a process that is not a verified Tribull ${service}: ${details}. Leaving it running.`);
  }
  return matches;
}

async function portIsAvailable(port) {
  if (getListenerPids(port).size > 0) return false;
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
      else reject(error);
    });
    server.listen({ port, host: "::", exclusive: true }, () => {
      server.close((error) => error ? reject(error) : resolve(true));
    });
  });
}

function startChild(name, args) {
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
    windowsHide: true,
  });
  ownedChildren.add(child);
  child.on("error", (error) => console.error(`Failed to start ${name}:`, error));
  return child;
}

function waitForChildExit(child, timeoutMs = Infinity) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    let timeout;
    const finish = () => {
      if (timeout) clearTimeout(timeout);
      child.removeListener("exit", finish);
      resolve();
    };
    child.once("exit", finish);
    if (Number.isFinite(timeoutMs)) timeout = setTimeout(finish, timeoutMs);
  });
}

async function stopOwnedChildren() {
  const active = [...ownedChildren].filter((child) => child.exitCode === null && child.signalCode === null);
  for (const child of active) {
    try {
      child.kill("SIGTERM");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
  await Promise.all(active.map((child) => waitForChildExit(child, shutdownTimeoutMs)));
  for (const child of active) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    try {
      child.kill("SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

async function waitForBackend(child) {
  const deadline = Date.now() + startupTimeoutMs;
  while (Date.now() < deadline) {
    if (shutdownSignal) throw shutdownError();
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Tribull backend exited before becoming ready (exit ${child.exitCode ?? child.signalCode}).`);
    }
    try {
      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: "127.0.0.1", port: 5001 });
        socket.once("connect", () => {
          socket.destroy();
          resolve();
        });
        socket.once("error", reject);
      });
      return;
    } catch {
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 200)),
        shutdownRequested,
      ]);
    }
  }
  throw new Error("Timed out waiting for the Tribull backend on port 5001.");
}

async function startFrontend(port) {
  const vitePath = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
  const child = startChild("Vite frontend", [vitePath, "--host", "--port", String(port), "--strictPort"]);

  try {
    const deadline = Date.now() + startupTimeoutMs;
    while (Date.now() < deadline) {
      if (shutdownSignal) throw shutdownError();
      if (child.exitCode !== null || child.signalCode !== null) {
        const error = new Error(`Vite exited before becoming ready on port ${port} (exit ${child.exitCode ?? child.signalCode}).`);
        error.portInUse = getListenerPids(port).size > 0;
        throw error;
      }
      if (getListenerPids(port).has(child.pid)) return child;
      await Promise.race([
        new Promise((resolve) => setTimeout(resolve, 200)),
        shutdownRequested,
      ]);
    }
    throw new Error(`Timed out waiting for Vite on port ${port}.`);
  } catch (error) {
    try {
      child.kill("SIGTERM");
    } catch (killError) {
      if (killError.code !== "ESRCH") throw killError;
    }
    await waitForChildExit(child, shutdownTimeoutMs);
    throw error;
  }

  return child;
}

async function main() {
  const processes = getProcessTree();
  const backendListeners = verifyServiceListeners(5001, processes, "backend");
  if (backendListeners.length > 0) {
    console.log(`Reusing verified Tribull backend on http://192.168.31.155:5001 (PID ${backendListeners.map(({ pid }) => pid).join(", ")}).`);
  } else {
    console.log("Starting Tribull backend on 0.0.0.0:5001...");
    const backend = startChild("Tribull backend", [
      path.join(projectRoot, "node_modules", "tsx", "dist", "cli.mjs"),
      "backend/index.ts",
    ]);
    await waitForBackend(backend);
  }

  const frontendListeners = [];
  for (const port of frontendPorts) {
    const pids = getListenerPids(port);
    if (pids.size === 0) continue;
    const matches = [...pids].map((pid) => ({ pid, isTribullService: belongsToTribullService(pid, processes, "frontend") }));
    if (matches.every((match) => match.isTribullService)) {
      frontendListeners.push(...matches.map((match) => ({ ...match, port })));
    } else {
      const details = matches
        .filter((match) => !match.isTribullService)
        .map(({ pid }) => `PID ${pid}: ${describeListener(pid, processes)}`)
        .join("; ");
      console.warn(`Port ${port} is occupied by an unrelated or unverified process (${details}); preserving it.`);
    }
  }

  let frontendPort;
  if (frontendListeners.length > 0) {
    const existing = frontendListeners[0];
    frontendPort = existing.port;
    console.log(`Reusing verified Tribull Vite frontend on port ${frontendPort} (PID ${existing.pid}).`);
    console.log(`To stop only that verified frontend: Stop-Process -Id ${existing.pid}`);
    if (frontendListeners.length > 1) {
      console.warn(`Found ${frontendListeners.length} Tribull Vite listeners; not starting another frontend.`);
    }
  } else {
    for (const port of frontendPorts) {
      if (!await portIsAvailable(port)) {
        if (port === 3000) {
          const listeners = getListenerPids(port);
          console.warn(`Port 3000 is occupied (PID ${[...listeners].join(", ") || "unidentified"}); preserving its process and checking the next port.`);
        }
        continue;
      }
      try {
        await startFrontend(port);
        frontendPort = port;
        break;
      } catch (error) {
        if (!error.portInUse) throw error;
        console.warn(`Port ${port} became occupied during Vite startup; leaving its process untouched and checking the next port.`);
      }
    }
  }

  if (frontendPort === undefined) {
    throw new Error(`No available frontend port in the range ${frontendPorts[0]}-${frontendPorts.at(-1)}.`);
  }

  console.log(`Frontend: http://localhost:${frontendPort}`);
  console.log(`LAN frontend: http://192.168.31.155:${frontendPort}`);
  console.log("Backend: http://192.168.31.155:5001");

  const activeChildren = [...ownedChildren];
  const unexpectedExit = Promise.race(activeChildren.map(async (child) => {
    await waitForChildExit(child);
    return child;
  }));
  if (activeChildren.length === 0) {
    const keepAlive = setInterval(() => {}, 60_000);
    try {
      await shutdownRequested;
    } finally {
      clearInterval(keepAlive);
    }
  } else {
    const result = await Promise.race([shutdownRequested, unexpectedExit]);
    if (result?.signal) {
      console.log(`Received ${result.signal}; stopping only child processes started by this script.`);
    } else {
      const child = result;
      console.error(`A development child exited unexpectedly (exit ${child.exitCode ?? child.signalCode}); stopping remaining managed children.`);
      process.exitCode = child.exitCode && child.exitCode !== 0 ? child.exitCode : 1;
    }
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof Error && error.name === "ShutdownRequestedError") {
    console.log(error.message);
  } else {
    console.error("Development server startup failed:", error);
    process.exitCode = 1;
  }
} finally {
  await stopOwnedChildren();
}
