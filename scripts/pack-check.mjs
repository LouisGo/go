import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cacheDir = await mkdtemp(join(tmpdir(), "louisgo-npm-cache-"));
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  const exitCode = await run(npmCommand, ["pack", "--dry-run"], {
    ...process.env,
    npm_config_cache: cacheDir,
  });
  process.exitCode = exitCode;
} finally {
  await rm(cacheDir, { force: true, recursive: true });
}

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${command} was terminated by ${signal}`));
        return;
      }

      resolve(code ?? 1);
    });
  });
}
