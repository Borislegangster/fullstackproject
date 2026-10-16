#!/usr/bin/env node
/**
 * Garde-fou des liens internes : tout lien profond vers une page de l'application doit correspondre à une route
 * Next.js existante.
 *  - backend : liens de notifications, e-mails, push, WhatsApp (gabarits « /erp/x/{{ id }} », f-strings…) ;
 *  - web : href, router.push / replace, redirect.
 * Les liens vers des pages CMS (slugs libres servis par le catch-all public) ne sont pas vérifiables ici.
 * Code de sortie 1 si un lien est orphelin (exécuté en CI).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const APP = join(WEB, "src", "app");
const SRC = join(WEB, "src");
const BACKEND = join(WEB, "..", "..", "backend", "app");

function walk(dir, accept, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "__pycache__" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, accept, out);
    else if (accept(name)) out.push(path);
  }
  return out;
}

/* ------------------------------------------------------------------ routes */
const routes = [];
const topLevel = new Set();
for (const file of walk(APP, (n) => n === "page.tsx" || n === "page.ts")) {
  const segments = relative(APP, file).split(sep).slice(0, -1).filter((s) => !/^\(.*\)$/.test(s));
  if (segments.length === 1 && /^\[\.\.\..+\]$/.test(segments[0])) continue; // catch-all CMS racine
  if (segments.length && !segments[0].startsWith("[")) topLevel.add(segments[0]);
  const pattern = segments
    .map((s) => {
      if (/^\[\[\.\.\..+\]\]$/.test(s)) return "(?:/.*)?";
      if (/^\[\.\.\..+\]$/.test(s)) return "/.+";
      if (/^\[.+\]$/.test(s)) return "/[^/]+";
      return `/${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`;
    })
    .join("");
  routes.push({ file: relative(WEB, file), re: new RegExp(`^${pattern || "/"}$`) });
}

/* ------------------------------------------------------------------ liens */
const PARAM = "__p__";
function normalize(raw) {
  const path = raw
    .replace(/\{\{[^}]*\}\}/g, PARAM)
    .replace(/\$\{[^}]*\}/g, PARAM)
    .replace(/\{[^}]*\}/g, PARAM)
    .split(/[?#]/)[0]
    .replace(/\/+$/, "");
  return path || "/";
}

const links = [];
const BACKEND_LINK = /f?(["'])(\/(?:erp|espace-client|extranet)(?:[/?][^"'\s]*)?)\1/g;
for (const file of walk(BACKEND, (n) => n.endsWith(".py"))) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/prefix\s*=|APIRouter|^\s*#/.test(line)) return;
      for (const m of line.matchAll(BACKEND_LINK)) links.push({ raw: m[2], where: `${relative(join(WEB, "..", ".."), file)}:${i + 1}` });
    });
}
const WEB_LINK = /(?:\bhref\s*[=:]\s*\{?\s*|\brouter\.(?:push|replace)\(\s*|\bredirect\(\s*|\blocation(?:\.href)?\s*=\s*)(["'`])(\/[^"'`\s]*)\1/g;
for (const file of walk(SRC, (n) => /\.(tsx?|mjs)$/.test(n))) {
  if (file.includes(`${sep}generated${sep}`)) continue;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(WEB_LINK)) links.push({ raw: m[2], where: `${relative(WEB, file)}:${i + 1}` });
    });
}

/* ------------------------------------------------------------------ contrôle */
const missing = [];
let checked = 0;
for (const link of links) {
  const path = normalize(link.raw);
  const first = path.split("/")[1] ?? "";
  if (path !== "/" && !topLevel.has(first)) continue; // page CMS ou ressource statique
  if (/\.[a-z0-9]{2,5}$/i.test(path)) continue;
  checked += 1;
  const probe = path.replaceAll(PARAM, "x");
  if (!routes.some((r) => r.re.test(probe))) missing.push({ ...link, path });
}

if (missing.length) {
  console.error(`✖ ${missing.length} lien(s) interne(s) sans route :`);
  for (const m of missing) console.error(`  ${m.path}   ← ${m.raw}   (${m.where})`);
  process.exit(1);
}
console.log(`✔ ${checked} liens internes vérifiés sur ${routes.length} routes.`);
