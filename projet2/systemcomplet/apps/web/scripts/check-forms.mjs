#!/usr/bin/env node
/**
 * Contrôle des formulaires générés (SchemaForm / ResourceView) : chaque champ affiché doit être saisissable par un
 * utilisateur non technique.
 *
 *  - un identifiant (fiche liée, fichier, média) doit avoir un sélecteur : référentiel (lib/refs.ts), configuration
 *    `ref` ou rendu dédié (`render`) — sinon le formulaire afficherait une case « Identifiant » à remplir à la main ;
 *  - un champ JSON doit avoir un éditeur dédié (`render` ou `widget`) — jamais de JSON à taper.
 *
 * Les champs masqués (`exclude`, `hidden`, `fixed`, `only`) et les paramètres de chemin ne sont pas concernés.
 * Échoue (code 1) en listant les champs à corriger.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const src = readFileSync(join(WEB, "src/generated/schemas.ts"), "utf8");
const refsText = readFileSync(join(WEB, "src/lib/refs.ts"), "utf8");
const grab = (name) => Function(`return ${src.match(new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`))[1]}`)();
const SCHEMAS = grab("SCHEMAS");
const BODIES = grab("BODIES");
// Champs reliés d'office à un référentiel (FIELD_REFS / LIST_REFS de lib/refs.ts).
const refBlock = (name) => refsText.match(new RegExp(`export const ${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`))?.[1] ?? "";
const FIELD_REFS = new Set([...refBlock("FIELD_REFS").matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]));
const LIST_REFS = new Set([...refBlock("LIST_REFS").matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]));

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "generated") walk(path);
    } else if (/\.tsx?$/.test(name)) files.push(path);
  }
};
walk(join(WEB, "src"));

const keysOf = (node) => {
  if (!node) return { keys: new Set(), dynamic: false, nodes: new Map() };
  if (ts.isObjectLiteralExpression(node)) {
    const keys = new Set();
    const nodes = new Map();
    let dynamic = false;
    for (const p of node.properties) {
      if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name) {
        const k = p.name.getText().replace(/["']/g, "");
        keys.add(k);
        if (ts.isPropertyAssignment(p)) nodes.set(k, p.initializer);
      } else dynamic = true; // ...spread : clés inconnues
    }
    return { keys, dynamic, nodes };
  }
  return { keys: new Set(), dynamic: true, nodes: new Map() }; // variable : clés inconnues
};
// Réglage qui désactive le sélecteur d'un identifiant (`ref: null`) sans rendu ni liste de choix : saisie technique.
const disablesRef = (node) =>
  !!node &&
  ts.isObjectLiteralExpression(node) &&
  node.properties.some((p) => ts.isPropertyAssignment(p) && p.name.getText() === "ref" && p.initializer.kind === ts.SyntaxKind.NullKeyword) &&
  !node.properties.some((p) => ts.isPropertyAssignment(p) && ["render", "options", "hidden"].includes(p.name.getText()));
const stringsOf = (node) => (node && ts.isArrayLiteralExpression(node) ? node.elements.filter(ts.isStringLiteral).map((e) => e.text) : null);

const forms = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (!text.includes("endpoint")) continue;
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  // Variables du fichier (`const fields = {…}`) : une configuration `fields` ou `{ fields }` y renvoie.
  const decls = [];
  const collect = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) decls.push(node);
    ts.forEachChild(node, collect);
  };
  collect(sf);
  const resolve = (node, at) => {
    let expr = node;
    while (expr && (ts.isAsExpression(expr) || ts.isParenthesizedExpression(expr) || ts.isSatisfiesExpression?.(expr))) expr = expr.expression;
    if (!expr || !ts.isIdentifier(expr)) return expr;
    // Déclaration homonyme la plus proche qui précède l'utilisation
    const candidates = decls.filter((d) => d.name.text === expr.text && d.getStart() < at);
    return candidates.length ? resolve(candidates[candidates.length - 1].initializer, candidates[candidates.length - 1].getStart()) : expr;
  };
  const visit = (node) => {
    // Objet de configuration { endpoint: "POST /x", fields, exclude, fixed, only }
    if (ts.isObjectLiteralExpression(node)) {
      const props = Object.fromEntries(
        node.properties
          .filter((p) => ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p))
          .map((p) => [p.name.getText(), resolve(ts.isPropertyAssignment(p) ? p.initializer : p.name, node.getStart())]),
      );
      const ep = props.endpoint;
      if (ep && (ts.isStringLiteral(ep) || ts.isNoSubstitutionTemplateLiteral(ep))) {
        forms.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endpoint: ep.text, fields: props.fields, exclude: props.exclude, fixed: props.fixed, only: props.only ?? props.columns });
      }
    }
    // <SchemaForm endpoint="POST /x" fields={…} exclude={…} fixed={…} />
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const attrs = Object.fromEntries(
        node.attributes.properties
          .filter(ts.isJsxAttribute)
          .map((a) => [a.name.getText(), resolve(a.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer, node.getStart())]),
      );
      const ep = attrs.endpoint;
      if (ep && ts.isStringLiteral(ep)) {
        forms.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endpoint: ep.text, fields: attrs.fields, exclude: attrs.exclude, fixed: attrs.fixed, only: attrs.only });
      } else if (attrs.schema && ts.isStringLiteral(attrs.schema)) {
        // Formulaire déclaré par son schéma (enregistrement via onSubmit)
        forms.push({ file, line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, endpoint: `schema:${attrs.schema.text}`, schema: attrs.schema.text, fields: attrs.fields, exclude: attrs.exclude, fixed: attrs.fixed, only: attrs.only });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const problems = [];
for (const form of forms) {
  const body = form.schema ? { schema: form.schema } : BODIES[form.endpoint];
  if (!body) continue;
  const defs = SCHEMAS[body.schema] ?? [];
  const cfg = keysOf(form.fields);
  const fixed = keysOf(form.fixed);
  const exclude = new Set(stringsOf(form.exclude) ?? []);
  const only = stringsOf(form.only);
  for (const def of defs) {
    const name = def.name;
    if ((def.kind === "uuid" || (def.kind === "list" && def.itemKind === "uuid")) && disablesRef(cfg.nodes.get(name))) {
      problems.push(`${relative(WEB, form.file).replace(/\\/g, "/")}:${form.line}  ${form.endpoint}  ${name} — sélecteur désactivé (ref: null)`);
      continue;
    }
    if (form.endpoint.includes(`{${name}}`) || exclude.has(name) || fixed.keys.has(name) || cfg.keys.has(name)) continue;
    if (only && !only.includes(name)) continue;
    if (fixed.dynamic && name === "project_id") continue; // contexte de projet imposé par l'écran
    const isId = def.kind === "uuid";
    const isIdList = def.kind === "list" && def.itemKind === "uuid";
    const isJson = def.kind === "json" || (def.kind === "list" && (def.itemKind === "json" || def.itemKind === "object"));
    let issue = null;
    // Adresse courte d'un contenu existant (offre, service…) : à choisir dans une liste, jamais à taper.
    const isSlugRef = def.kind === "string" && /(_slug|^offer_code)$/.test(name);
    if (isSlugRef) issue = "adresse technique (slug) à taper";
    else if (isId && !FIELD_REFS.has(name)) issue = "identifiant sans sélecteur";
    else if (isIdList && !LIST_REFS.has(name)) issue = "liste d'identifiants sans sélecteur";
    else if (isJson) issue = "JSON sans éditeur";
    if (issue && !cfg.dynamic) problems.push(`${relative(WEB, form.file).replace(/\\/g, "/")}:${form.line}  ${form.endpoint}  ${name} — ${issue}`);
  }
}

if (problems.length) {
  console.error(`✖ ${problems.length} champ(s) de formulaire non saisissables par un utilisateur :\n  ${[...new Set(problems)].sort().join("\n  ")}`);
  process.exit(1);
}
console.log(`✔ Formulaires : ${forms.length} formulaires générés, tous les champs ont un sélecteur ou un éditeur.`);
