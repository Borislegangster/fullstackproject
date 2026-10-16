#!/usr/bin/env node
/**
 * Inventaire des fonctionnalités de l'interface (ERP, espace client, extranet), extrait du code par analyse
 * syntaxique TypeScript : menus, onglets, listes (création, modification, suppression, actions de ligne et
 * permissions), titres de pages / sections / fenêtres et libellés des boutons.
 *
 * Sert à rédiger la documentation intégrée et à en contrôler l'exhaustivité (scripts/check-docs.mjs).
 *   node scripts/docs-inventory.mjs [--json] [filtre-de-fichier]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

export const WEB = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(WEB, "src");

/** Espace documentaire d'un fichier source. */
export function spaceOf(file) {
  const rel = relative(SRC, file).split(sep).join("/");
  if (rel.startsWith("app/erp/") || rel.startsWith("components/erp/") || rel.startsWith("components/cms/") || rel.startsWith("components/bim/") || rel.startsWith("components/planning/")) return "erp";
  if (rel.startsWith("app/espace-client/") || rel.startsWith("components/client/")) return "client";
  if (rel.startsWith("app/extranet/") || rel.startsWith("components/extranet/")) return "extranet";
  if (rel.startsWith("components/agenda/")) return "erp";
  if (rel.startsWith("components/procurement/")) return "extranet";
  if (rel.startsWith("components/support/")) return "shared";
  if (/^components\/(comms|innovations|three|account|calls|configurator)\//.test(rel) || rel.startsWith("app/(auth)/")) return "shared";
  return null;
}

function walkFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkFiles(path, out);
    else if (/\.tsx$/.test(name)) out.push(path);
  }
  return out;
}

const textOf = (node) => {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isJsxExpression(node)) return textOf(node.expression);
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((s) => `{${s.expression.getText()}}${s.literal.text}`).join("");
  if (ts.isParenthesizedExpression(node)) return textOf(node.expression);
  if (ts.isJsxElement(node) || ts.isJsxFragment(node)) return jsxText(node);
  return null;
};

function jsxText(node) {
  const parts = [];
  const visit = (n) => {
    if (ts.isJsxText(n)) parts.push(n.text);
    else if (ts.isJsxExpression(n) && n.expression && (ts.isStringLiteral(n.expression) || ts.isNoSubstitutionTemplateLiteral(n.expression))) parts.push(n.expression.text);
    else ts.forEachChild(n, visit);
  };
  ts.forEachChild(node, visit);
  return parts.join(" ").replace(/\s+/g, " ").trim() || null;
}

const propOf = (obj, name) => {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return undefined;
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && (p.name.getText().replace(/["']/g, "") === name)) return p.initializer;
    if (ts.isShorthandPropertyAssignment(p) && p.name.getText() === name) return p.name;
  }
  return undefined;
};

const strings = (node) => {
  if (!node) return [];
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(textOf).filter(Boolean);
  const one = textOf(node);
  return one ? [one] : [];
};

const attr = (el, name) => {
  const attrs = (ts.isJsxElement(el) ? el.openingElement : el).attributes.properties;
  for (const a of attrs) if (ts.isJsxAttribute(a) && a.name.getText() === name) return a.initializer ? textOf(a.initializer) : true;
  return undefined;
};

const tagName = (el) => (ts.isJsxElement(el) ? el.openingElement : el).tagName.getText();

/** Inventaire d'un fichier TSX. */
export function inventoryOf(file) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inv = { file: relative(WEB, file).split(sep).join("/"), space: spaceOf(file), resources: [], tabs: [], titles: [], dialogs: [], buttons: [], perms: [], nav: [] };
  const visit = (node) => {
    // Configuration de liste (ResourceView) : titre + chemin / colonnes.
    if (ts.isObjectLiteralExpression(node) && propOf(node, "title") && (propOf(node, "path") || propOf(node, "columns"))) {
      const create = propOf(node, "create");
      const update = propOf(node, "update");
      const remove = propOf(node, "remove");
      const actions = propOf(node, "actions");
      const filters = propOf(node, "filters");
      inv.resources.push({
        title: textOf(propOf(node, "title")),
        subtitle: textOf(propOf(node, "subtitle")),
        path: textOf(propOf(node, "path")),
        create: create && ts.isObjectLiteralExpression(create) ? { label: textOf(propOf(create, "label")), endpoint: textOf(propOf(create, "endpoint")), perms: strings(propOf(create, "perms")) } : null,
        update: update && ts.isObjectLiteralExpression(update) ? { endpoint: textOf(propOf(update, "endpoint")), perms: strings(propOf(update, "perms")) } : null,
        remove: remove && ts.isObjectLiteralExpression(remove) ? { perms: strings(propOf(remove, "perms")), confirm: textOf(propOf(remove, "confirm")) } : null,
        actions:
          actions && ts.isArrayLiteralExpression(actions)
            ? actions.elements.filter(ts.isObjectLiteralExpression).map((a) => ({
                label: textOf(propOf(a, "label")),
                endpoint: textOf(propOf(a, "endpoint")) ?? (propOf(a, "path") ? "(chemin calculé)" : propOf(a, "run") ? "(action locale)" : null),
                perms: strings(propOf(a, "perms")),
                confirm: textOf(propOf(a, "confirm")),
              }))
            : [],
        filters: filters && ts.isArrayLiteralExpression(filters) ? filters.elements.filter(ts.isObjectLiteralExpression).map((f) => textOf(propOf(f, "label"))).filter(Boolean) : [],
        export: textOf(propOf(node, "exportDataset")),
      });
    }
    // Onglets / menus : tableaux d'objets { key, label } (hors colonnes).
    if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2 && !(ts.isPropertyAssignment(node.parent) && /columns|filters|options/.test(node.parent.name.getText()))) {
      const els = node.elements;
      if (els.every((e) => ts.isObjectLiteralExpression(e) && e.properties.every((p) => ts.isPropertyAssignment(p) && ["key", "label", "count", "hidden"].includes(p.name.getText())) && textOf(propOf(e, "label")) && propOf(e, "key"))) {
        inv.tabs.push(els.map((e) => textOf(propOf(e, "label"))));
      }
    }
    // Entrées de menu (layouts).
    if (ts.isObjectLiteralExpression(node) && textOf(propOf(node, "href")) && textOf(propOf(node, "label")) && /^\/(erp|espace-client|extranet)/.test(textOf(propOf(node, "href")))) {
      inv.nav.push({ href: textOf(propOf(node, "href")), label: textOf(propOf(node, "label")), perms: strings(propOf(node, "perms")), spaces: strings(propOf(node, "spaces")) });
    }
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      if (tag === "PageTitle" || tag === "CardHeader") {
        const title = attr(node, "title");
        if (typeof title === "string") inv.titles.push({ kind: tag === "PageTitle" ? "page" : "section", title, subtitle: typeof attr(node, "subtitle") === "string" ? attr(node, "subtitle") : null });
      }
      if (["Modal", "ConfirmDialog", "OtpDialog", "Drawer"].includes(tag)) {
        const title = attr(node, "title");
        if (typeof title === "string") inv.dialogs.push(title);
      }
      if (ts.isJsxElement(node) && ["Button", "button", "LinkButton", "Link", "a", "label"].includes(tag)) {
        const label = jsxText(node);
        if (label && label.length > 1 && label.length < 80 && !/^[\d\s.,…/%+-]+$/.test(label)) inv.buttons.push(label);
      }
    }
    // Contrôles de permission dans l'interface.
    if (ts.isCallExpression(node) && /^(can|canAny|hasRole|require|has|has_any)$/.test(node.expression.getText().split(".").pop())) {
      for (const a of node.arguments) {
        const s = textOf(a);
        if (s && (/^[a-z_]+:[a-z_]+$/.test(s) || /^[A-Z_]{3,}$/.test(s))) inv.perms.push(s);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  inv.buttons = [...new Set(inv.buttons)];
  inv.perms = [...new Set(inv.perms)];
  inv.dialogs = [...new Set(inv.dialogs)];
  return inv;
}

export function inventory() {
  return walkFiles(SRC)
    .filter((f) => spaceOf(f))
    .map(inventoryOf)
    .filter((i) => i.resources.length || i.tabs.length || i.titles.length || i.dialogs.length || i.buttons.length || i.nav.length);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const json = process.argv.includes("--json");
  const filter = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const all = inventory().filter((i) => !filter || i.file.includes(filter));
  if (json) {
    process.stdout.write(JSON.stringify(all, null, 1));
  } else {
    for (const i of all) {
      console.log(`\n## ${i.file} [${i.space}]`);
      for (const n of i.nav) console.log(`  menu ${n.href} « ${n.label} »${n.perms.length ? ` perms=${n.perms.join("|")}` : ""}${n.spaces.length ? ` espaces=${n.spaces.join("|")}` : ""}`);
      for (const t of i.titles) console.log(`  ${t.kind} « ${t.title} »${t.subtitle ? ` — ${t.subtitle}` : ""}`);
      for (const t of i.tabs) console.log(`  onglets : ${t.join(" · ")}`);
      for (const r of i.resources) {
        console.log(`  liste « ${r.title} » ${r.path ?? ""}${r.subtitle ? ` — ${r.subtitle}` : ""}`);
        if (r.create) console.log(`    + créer « ${r.create.label ?? "(défaut)"} » ${r.create.endpoint ?? ""} perms=${r.create.perms.join("|") || "-"}`);
        if (r.update) console.log(`    ✎ modifier ${r.update.endpoint ?? ""} perms=${r.update.perms.join("|") || "-"}`);
        if (r.remove) console.log(`    ✕ supprimer perms=${r.remove.perms.join("|") || "-"}${r.remove.confirm ? ` (${r.remove.confirm})` : ""}`);
        for (const a of r.actions) console.log(`    → « ${a.label} » ${a.endpoint ?? ""} perms=${a.perms.join("|") || "-"}${a.confirm ? ` (${a.confirm})` : ""}`);
        if (r.filters.length) console.log(`    filtres : ${r.filters.join(", ")}`);
        if (r.export) console.log(`    export : ${r.export}`);
      }
      if (i.dialogs.length) console.log(`  fenêtres : ${i.dialogs.join(" · ")}`);
      if (i.buttons.length) console.log(`  boutons : ${i.buttons.join(" · ")}`);
      if (i.perms.length) console.log(`  contrôles : ${i.perms.join(", ")}`);
    }
  }
}
