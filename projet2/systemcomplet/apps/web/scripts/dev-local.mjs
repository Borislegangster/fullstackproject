#!/usr/bin/env node
/**
 * Démarre Next.js en développement contre l'API locale lancée par backend/scripts/dev_server.py.
 * Ports par défaut : web 3010 → API 8010 (WEB_PORT / API_PORT pour les changer).
 */
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webPort = process.env.WEB_PORT ?? "3010";
const apiPort = process.env.API_PORT ?? "8010";
const next = resolve(root, "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "dev", "-p", webPort], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-dev",
    API_INTERNAL_URL: process.env.API_INTERNAL_URL ?? `http://localhost:${apiPort}`,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? `http://localhost:${webPort}`,
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
