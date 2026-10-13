import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `${command} exited with status ${result.status}`);
  }
  return result.stdout;
}

function getListenerPids(port) {
  if (process.platform === "win32") {
    const output = run("netstat", ["-ano", "-p", "tcp"]);
    return new Set(
      output
        .split(/\r?\n/)
        .flatMap((line) => {
          const match = line.match(/^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
          return match?.[1] === String(port) ? [Number(match[2])] : [];
        }),
    );
  }

  const lsof = spawnSync("lsof", ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });
  if (lsof.error?.code !== "ENOENT") {
    if (lsof.error) throw lsof.error;
    if (lsof.status === 1 && !lsof.stdout.trim()) return new Set();
    if (lsof.status !== 0) {
      throw new Error(lsof.stderr.trim() || `lsof exited with status ${lsof.status}`);
    }
    return new Set(lsof.stdout.split(/\r?\n/).filter(Boolean).map(Number));
  }

  const output = run("ss", ["-ltnp"]);
  const listeners = output.split(/\r?\n/).filter((line) => new RegExp(`:${port}\\s`).test(line));
  const pids = listeners.flatMap((line) =>
    [...line.matchAll(/pid=(\d+)/g)].map((match) => Number(match[1])),
  );
  if (listeners.length > 0 && pids.length === 0) {
    throw new Error(`Port ${port} is occupied, but its process could not be identified.`);
  }
  return new Set(pids);
}

function getProcessTree() {
  if (process.platform === "win32") {
    const output = run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress",
    ]);
    const processes = JSON.parse(output);
    return (Array.isArray(processes) ? processes : [processes]).map((item) => ({
      pid: Number(item.ProcessId),
      parentPid: Number(item.ParentProcessId),
      commandLine: item.CommandLine || "",
    }));
  }

  return run("ps", ["-eo", "pid=,ppid=,args="])
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
      return match
        ? [{ pid: Number(match[1]), parentPid: Number(match[2]), commandLine: match[3] }]
        : [];
    });
}

function belongsToTribullBackend(pid, processes) {
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const lineage = [];
  let current = byPid.get(pid);
  while (current && !lineage.some((process) => process.pid === current.pid)) {
    lineage.push(current);
    current = byPid.get(current.parentPid);
  }

  const normalize = (value) => value.replaceAll("\\", "/").toLowerCase();
  const root = normalize(projectRoot).replace(/\/+$/, "");
  const sameProject = lineage.some((process) => normalize(process.commandLine).includes(root));
  const backendProcess = lineage.some((process) =>
    /(?:backend\/index\.ts|dist\/index\.js)/i.test(normalize(process.commandLine)),
  );
  return sameProject && backendProcess;
}

export async function stopTribullBackend(port = 5001) {
  const pids = getListenerPids(port);
  if (pids.size === 0) return;

  const processes = getProcessTree();
  const stalePids = [];
  for (const pid of pids) {
    if (!belongsToTribullBackend(pid, processes)) {
      const process = processes.find((entry) => entry.pid === pid);
      throw new Error(
        `Port ${port} is occupied by an unidentified process (PID ${pid}: ${process?.commandLine || "unknown"}); leaving it running.`,
      );
    }
    stalePids.push(pid);
  }

  for (const pid of stalePids) {
    console.log(`Stopping stale Tribull backend on port ${port} (PID ${pid}).`);
    process.kill(pid, "SIGTERM");
  }

  const deadline = Date.now() + 5000;
  while (getListenerPids(port).size > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (getListenerPids(port).size > 0) {
    throw new Error(`Port ${port} is still occupied after stopping the stale Tribull backend.`);
  }
}
