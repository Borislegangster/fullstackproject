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

// Visionneuse PDF intégrée (pdf.js, version « legacy » pour les navigateurs mobiles anciens) : worker, polices
// standard et tables de caractères servis par le site lui-même (aucun CDN).
import { cpSync } from "node:fs";

const pdfjs = resolve(root, "node_modules/pdfjs-dist");
if (existsSync(pdfjs)) {
  const out = resolve(root, "public/pdfjs");
  mkdirSync(out, { recursive: true });
  copyFileSync(resolve(pdfjs, "legacy/build/pdf.worker.min.mjs"), resolve(out, "pdf.worker.min.mjs"));
  cpSync(resolve(pdfjs, "cmaps"), resolve(out, "cmaps"), { recursive: true });
  cpSync(resolve(pdfjs, "standard_fonts"), resolve(out, "standard_fonts"), { recursive: true });
  console.log("pdf.js (worker, polices, cmaps) copié dans public/pdfjs/");
} else {
  console.warn("pdfjs-dist non installé : aperçu PDF intégré indisponible");
}
