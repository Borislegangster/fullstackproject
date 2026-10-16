#!/usr/bin/env node
/** Copie des ressources binaires tierces servies statiquement (WASM web-ifc pour la visionneuse IFC navigateur). */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/wasm");
mkdirSync(target, { recursive: true });
const source = resolve(root, "node_modules/web-ifc/web-ifc.wasm");
if (existsSync(source)) {
  copyFileSync(source, resolve(target, "web-ifc.wasm"));
  console.log("web-ifc.wasm copié dans public/wasm/");
} else {
  console.warn("web-ifc non installé : visionneuse IFC indisponible");
}
