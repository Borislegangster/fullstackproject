#!/usr/bin/env node
/**
 * Exhaustivité et cohérence de la documentation intégrée (backend/app/modules/docs/content) :
 *  - chaque entrée de menu (ERP, espace client, extranet) est documentée par une page de son espace ;
 *  - chaque action de l'interface (création, actions de ligne, onglets, fenêtres) est décrite dans son espace ;
 *  - les liens vers les écrans, les liens « doc: », les permissions, rôles et espaces cités existent.
 * Échoue (code 1) en listant ce qui manque : une nouvelle fonction ne peut pas être livrée sans sa documentation.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { inventory, WEB } from "./docs-inventory.mjs";

const ROOT = join(WEB, "..", "..");
const CONTENT = join(ROOT, "backend", "app", "modules", "docs", "content");
const APP = join(WEB, "src", "app");

const walk = (dir, accept, out = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, accept, out);
    else if (accept(name)) out.push(path);
  }
  return out;
};

const norm = (s) =>
  s
    .replace(/&apos;/g, "'")
    .replace(/[’`]/g, "'")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/* ------------------------------------------------------------------ documentation */
const docs = walk(CONTENT, (n) => n.endsWith(".md")).map((file) => {
  const text = readFileSync(file, "utf8");
  const end = text.indexOf("\n---", 3);
  const meta = {};
  for (const line of text.slice(3, end).split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    meta[key] = value.startsWith("[") ? value.slice(1, -1).split(",").map((v) => v.trim()).filter(Boolean) : value;
  }
  const routes = [...(meta.route ? [meta.route] : []), ...(Array.isArray(meta.routes) ? meta.routes : meta.routes ? [meta.routes] : [])];
  const body = text.slice(end + 4);
  return { file: relative(ROOT, file).split(sep).join("/"), meta, routes, body, haystack: norm(`${meta.title} ${meta.summary} ${body}`) };
});
const byId = new Map(docs.map((d) => [d.meta.id, d]));
const problems = [];
const report = (msg) => problems.push(msg);

/* ------------------------------------------------------------------ référentiels */
const permSource = readFileSync(join(ROOT, "backend", "app", "core", "permissions.py"), "utf8");
const PERMS = new Set([...permSource.matchAll(/Perm\("([a-z_]+:[a-z_]+)"/g)].map((m) => m[1]));
const ROLES = new Set([...permSource.matchAll(/RoleDef\(\s*"([A-Z_]+)"/g)].map((m) => m[1]));
const SPACES = new Set(["erp", "client", "extranet_supplier", "extranet_subcontractor"]);

const appRoutes = walk(APP, (n) => n === "page.tsx").map((f) =>
  "/" +
  relative(APP, f)
    .split(sep)
    .slice(0, -1)
    .filter((s) => !/^\(.*\)$/.test(s))
    .join("/"),
);
const routeExists = (path) => {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const parts = clean.split("/").filter(Boolean);
  return appRoutes.some((r) => {
    const rp = r.split("/").filter(Boolean);
    return rp.length === parts.length && rp.every((seg, i) => seg.startsWith("[") || parts[i] === "*" || seg === parts[i]);
  });
};

/* ------------------------------------------------------------------ cohérence des pages */
for (const d of docs) {
  for (const key of ["id", "title", "space", "section", "order", "summary"]) if (!d.meta[key]) report(`${d.file} : champ « ${key} » manquant`);
  for (const r of d.routes) if (!routeExists(r)) report(`${d.file} : écran inexistant dans « route(s) » : ${r}`);
  for (const p of [].concat(d.meta.perms ?? [])) if (!PERMS.has(p)) report(`${d.file} : permission inconnue ${p}`);
  for (const r of [].concat(d.meta.roles ?? [])) if (!ROLES.has(r)) report(`${d.file} : rôle inconnu ${r}`);
  for (const s of [].concat(d.meta.spaces ?? [])) if (!SPACES.has(s)) report(`${d.file} : espace inconnu ${s}`);
  for (const r of [].concat(d.meta.related ?? [])) if (!byId.has(r)) report(`${d.file} : page liée inconnue ${r}`);
  for (const m of d.body.matchAll(/^:::\s*(perm|role|space)\s+(.+)$/gm)) {
    for (const v of m[2].split(/[,|]/).map((x) => x.trim()).filter(Boolean)) {
      const ok = m[1] === "perm" ? PERMS.has(v) : m[1] === "role" ? ROLES.has(v) : SPACES.has(v);
      if (!ok) report(`${d.file} : garde « ${m[1]} » inconnue : ${v}`);
    }
  }
  for (const m of d.body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const href = m[1];
    if (href.startsWith("doc:")) {
      if (!byId.has(href.slice(4))) report(`${d.file} : lien vers une page inconnue ${href}`);
    } else if (href.startsWith("/") && !routeExists(href)) report(`${d.file} : lien vers un écran inexistant ${href}`);
  }
}

/* ------------------------------------------------------------------ exhaustivité */
const inv = inventory();
const textOf = (space) => docs.filter((d) => space === "shared" || d.meta.space === space).map((d) => d.haystack).join("\n");
const corpus = { erp: textOf("erp"), client: textOf("client"), extranet: textOf("extranet"), shared: textOf("shared") };
const GENERIC = new Set(
  [
    "Annuler", "Enregistrer", "Modifier", "Supprimer", "Créer", "Ajouter", "Valider", "Confirmer", "Fermer", "Retour", "Envoyer",
    "Ouvrir", "PDF", "Copier", "Imprimer", "Rechercher", "Précédent", "Suivant", "Terminé", "Tous", "Toutes", "Aperçu", "Historique",
    "Exporter", "Accepter", "Refuser", "Rejeter", "Statut", "Média", "Supprimer", "Nouveau", "Actualiser", "HTML", "Version texte",
  ].map(norm),
);
const want = (label) => label && !label.includes("{") && !GENERIC.has(norm(label)) && norm(label).length > 2;

for (const i of inv) {
  const space = i.space;
  // Une permission testée par l'interface mais absente du catalogue masque l'action à tout le monde.
  for (const p of i.perms) {
    if (/^[a-z_]+:[a-z_]+$/.test(p) && !PERMS.has(p)) report(`${i.file} : l'interface teste une permission inexistante « ${p} »`);
    if (/^[A-Z_]{3,}$/.test(p) && !ROLES.has(p)) report(`${i.file} : l'interface teste un rôle inexistant « ${p} »`);
  }
  for (const n of i.nav) {
    const navSpace = n.href.startsWith("/erp") ? "erp" : n.href.startsWith("/espace-client") ? "client" : "extranet";
    if (n.href.endsWith("/documentation")) continue;
    if (!docs.some((d) => d.meta.space === navSpace && d.routes.includes(n.href))) report(`Menu non documenté (${navSpace}) : « ${n.label} » ${n.href}`);
  }
  const labels = [];
  for (const r of i.resources) {
    if (r.create?.label) labels.push(["création", r.create.label]);
    for (const a of r.actions) labels.push(["action", a.label]);
  }
  for (const t of i.tabs) for (const l of t) labels.push(["onglet", l]);
  for (const dlg of i.dialogs) labels.push(["fenêtre", dlg]);
  const hay = corpus[space] ?? corpus.shared;
  for (const [kind, label] of labels) {
    if (!want(label)) continue;
    if (!hay.includes(norm(label))) report(`${i.file} [${space}] : ${kind} non documenté(e) « ${label} »`);
  }
}

if (problems.length) {
  console.error(`✖ Documentation incomplète : ${problems.length} point(s)`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log(`✔ Documentation : ${docs.length} pages, ${inv.reduce((n, i) => n + i.nav.length, 0)} entrées de menu et toutes les actions de l'interface couvertes.`);
