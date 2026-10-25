import { execSync } from 'node:child_process';

const port = Number(process.argv[2] || process.env.PORT || 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${process.argv[2]}`);
  process.exit(1);
}

function pidsOnPortWindows(targetPort) {
  try {
    const out = execSync(`netstat -ano -p tcp`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;
      const local = parts[1] ?? '';
      const pid = Number(parts[parts.length - 1]);
      if (!Number.isInteger(pid) || pid <= 0) continue;
      if (
        local.endsWith(`:${targetPort}`) ||
        local.endsWith(`]:${targetPort}`)
      ) {
        pids.add(pid);
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

function pidsOnPortUnix(targetPort) {
  try {
    const out = execSync(`lsof -ti tcp:${targetPort} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\s+/)
      .map((value) => Number(value))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    return [];
  }
}

const isWin = process.platform === 'win32';
const pids = isWin ? pidsOnPortWindows(port) : pidsOnPortUnix(port);

for (const pid of pids) {
  try {
    if (isWin) {
      execSync(`taskkill /PID ${pid} /T /F`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    console.log(`Freed port ${port} (killed PID ${pid})`);
  } catch {
    console.warn(`Could not kill PID ${pid} on port ${port}`);
  }
}

if (pids.length === 0) {
  console.log(`Port ${port} is free`);
}
