#!/usr/bin/env node
/**
 * Génère le code Dart partagé des applications mobiles à partir des sources uniques du web :
 *   - libellés français (apps/web/src/lib/labels.ts + STATUS_LABELS / tons de statut de format.ts) ;
 *   - jetons de la charte graphique (variables --color-* de apps/web/src/app/globals.css) ;
 *   - schémas des formulaires (apps/web/src/generated/schemas.ts, issu de l'OpenAPI de l'API) et correspondance
 *     champ → référentiel (FIELD_REFS / LIST_REFS de apps/web/src/lib/refs.ts) : jamais d'identifiant saisi.
 * Usage : node packages/globus_core/tool/gen_shared.mjs [--check]
 * --check : échoue si les fichiers générés ne sont pas à jour (CI).
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const web = join(root, "apps/web/src");
const out = join(here, "../lib/src/generated");
const check = process.argv.includes("--check");

// ------------------------------------------------------------------ libellés (exécution des modules TS du web)
const tmp = mkdtempSync(join(tmpdir(), "globus-gen-"));
try {
  const format = readFileSync(join(web, "lib/format.ts"), "utf8");
  const labels = readFileSync(join(web, "lib/labels.ts"), "utf8").replace(/from\s+"\.\/format"/g, 'from "./format.ts"');
  writeFileSync(join(tmp, "format.ts"), format);
  writeFileSync(join(tmp, "labels.ts"), labels);
  const f = await import(pathToFileURL(join(tmp, "format.ts")).href);
  const l = await import(pathToFileURL(join(tmp, "labels.ts")).href);

  const tones = {};
  for (const status of probeStatuses(format)) tones[status] = f.statusTone(status);

  const dart = [
    "// GÉNÉRÉ par packages/globus_core/tool/gen_shared.mjs — ne pas modifier à la main.",
    "// dart format off",
    "// Source unique : apps/web/src/lib/labels.ts et apps/web/src/lib/format.ts.",
    "// ignore_for_file: lines_longer_than_80_chars",
    "",
    `const Map<String, String> kFieldLabels = ${dartMap(l.FIELD_LABELS)};`,
    "",
    `const Map<String, String> kOptionLabels = ${dartMap(l.OPTION_LABELS)};`,
    "",
    `const Map<String, String> kStatusLabels = ${dartMap(f.STATUS_LABELS)};`,
    "",
    `const Map<String, String> kStatusTones = ${dartMap(tones)};`,
    "",
    `const Map<String, String> kFieldWords = ${dartMap(extractWords(readFileSync(join(web, "lib/labels.ts"), "utf8")))};`,
    "",
    "/// Champs techniques jamais affichés dans une fiche (miroir de HIDDEN_FIELDS du web).",
    `const Set<String> kHiddenFields = {${l.HIDDEN_FIELDS.map(dartString).join(", ")}};`,
    "",
    "/// Corps de métier par famille (miroir de backend/app/modules/subcontracting/trades.py).",
    `const List<({String family, List<String> codes})> kPersonTrades = [${l.PERSON_TRADES.map(
      (g) => `(family: ${dartString(g.family)}, codes: [${g.codes.map(dartString).join(", ")}])`,
    ).join(", ")}];`,
    "",
  ].join("\n");
  emit("labels.g.dart", dart);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ------------------------------------------------------------------ jetons de la charte
const css = readFileSync(join(web, "app/globals.css"), "utf8");
const colors = {};
for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) colors[m[1]] = m[2].toUpperCase();
const required = ["brand-500", "accent-500", "surface", "ink", "muted", "line", "success", "warning", "danger"];
for (const key of required) if (!colors[key]) throw new Error(`Jeton --color-${key} absent de globals.css`);
const tokens = [
  "// GÉNÉRÉ par packages/globus_core/tool/gen_shared.mjs — ne pas modifier à la main.",
    "// dart format off",
  "// Source unique : variables --color-* de apps/web/src/app/globals.css (charte GLOBUS §3).",
  "import 'dart:ui';",
  "",
  "abstract final class GlobusTokens {",
  ...Object.entries(colors).map(([k, v]) => `  static const Color ${camel(k)} = Color(0xFF${v.slice(1)});`),
  "}",
  "",
].join("\n");
emit("tokens.g.dart", tokens);

// ------------------------------------------------------------------ schémas des formulaires
{
  const dir = mkdtempSync(join(tmpdir(), "globus-schemas-"));
  try {
    writeFileSync(join(dir, "schemas.ts"), readFileSync(join(web, "generated/schemas.ts"), "utf8"));
    const g = await import(pathToFileURL(join(dir, "schemas.ts")).href);
    const refsSource = readFileSync(join(web, "lib/refs.ts"), "utf8");
    const fieldDef = (f) => {
      const args = [dartString(f.name), dartString(f.kind)];
      const named = [];
      if (f.required) named.push("required: true");
      if (f.nullable) named.push("nullable: true");
      if (f.options) named.push(`options: [${f.options.map(dartString).join(", ")}]`);
      if (f.ref) named.push(`ref: ${dartString(f.ref)}`);
      if (f.itemKind) named.push(`itemKind: ${dartString(f.itemKind)}`);
      if (f.itemOptions) named.push(`itemOptions: [${f.itemOptions.map(dartString).join(", ")}]`);
      for (const k of ["maxLength", "minLength", "maxItems", "minItems"]) if (f[k] !== undefined) named.push(`${k}: ${f[k]}`);
      for (const k of ["min", "max"]) if (f[k] !== undefined) named.push(`${k}: ${Number(f[k])}`);
      if (f.default !== undefined) named.push(`defaultValue: ${dartValue(f.default)}`);
      if (f.help) named.push(`help: ${dartString(f.help)}`);
      return `FieldDef(${[...args, ...named].join(", ")})`;
    };
    const schemas = Object.keys(g.SCHEMAS)
      .sort()
      .map((name) => `  ${dartString(name)}: [${g.SCHEMAS[name].map(fieldDef).join(", ")}],`);
    const bodies = Object.keys(g.BODIES)
      .sort()
      .map((key) => `  ${dartString(key)}: (type: ${dartString(g.BODIES[key].type)}, schema: ${g.BODIES[key].schema === null ? "null" : dartString(g.BODIES[key].schema)}),`);
    const refMap = (name) => {
      const m = refsSource.match(new RegExp(String.raw`export const ${name}: Record<string, keyof typeof REFS> = \{([\s\S]*?)\r?\n\};`));
      if (!m) throw new Error(`${name} absent de refs.ts`);
      const out = {};
      for (const e of m[1].matchAll(/^\s*([a-z0-9_]+):\s*"([A-Za-z0-9]+)"/gm)) out[e[1]] = e[2];
      return out;
    };
    const dart = [
      "// GÉNÉRÉ par packages/globus_core/tool/gen_shared.mjs — ne pas modifier à la main.",
    "// dart format off",
      "// Source unique : apps/web/src/generated/schemas.ts (OpenAPI de l'API) et apps/web/src/lib/refs.ts.",
      "// ignore_for_file: lines_longer_than_80_chars",
      "import '../forms/schema.dart';",
      "",
      "const Map<String, List<FieldDef>> kSchemas = {",
      ...schemas,
      "};",
      "",
      "const Map<String, ({String type, String? schema})> kBodies = {",
      ...bodies,
      "};",
      "",
      `const Map<String, String> kFieldRefs = ${dartMap(refMap("FIELD_REFS"))};`,
      "",
      `const Map<String, String> kListRefs = ${dartMap(refMap("LIST_REFS"))};`,
      "",
    ].join("\n");
    emit("schemas.g.dart", dart);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ------------------------------------------------------------------ utilitaires
function emit(name, content) {
  const path = join(out, name);
  if (check) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current !== content) {
      console.error(`${name} n'est pas à jour : lancez node packages/globus_core/tool/gen_shared.mjs`);
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(path, content, { encoding: "utf8" });
  console.log(`écrit ${path}`);
}

function dartString(s) {
  return `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\$/g, "\\$").replace(/\n/g, "\\n")}'`;
}

function dartValue(v) {
  if (v === null) return "null";
  if (typeof v === "string") return dartString(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `<Object?>[${v.map(dartValue).join(", ")}]`;
  return `<String, Object?>{${Object.entries(v).map(([k, x]) => `${dartString(k)}: ${dartValue(x)}`).join(", ")}}`;
}

function dartMap(obj) {
  const entries = Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{\n${entries.map(([k, v]) => `  ${dartString(k)}: ${dartString(v)},`).join("\n")}\n}`;
}

function camel(key) {
  const parts = key.split("-");
  return parts[0] + parts.slice(1).map((p) => (/^\d/.test(p) ? p : p[0].toUpperCase() + p.slice(1))).join("");
}

/** Statuts listés dans les ensembles SUCCESS/DANGER/WARNING/INFO de format.ts. */
function probeStatuses(source) {
  const set = new Set();
  for (const m of source.matchAll(/const (SUCCESS|DANGER|WARNING|INFO) = new Set\(\[([\s\S]*?)\]\)/g))
    for (const s of m[2].matchAll(/"([^"]+)"/g)) set.add(s[1]);
  return [...set];
}

/** Dictionnaire WORDS (non exporté) de labels.ts : mots utilisés pour les libellés de champs dérivés. */
function extractWords(source) {
  const m = source.match(/const WORDS: Record<string, string> = \{([\s\S]*?)\n\};/);
  if (!m) return {};
  const words = {};
  for (const e of m[1].matchAll(/^\s*([a-z0-9_]+|"[^"]+"):\s*"([^"]*)"/gm)) words[e[1].replace(/"/g, "")] = e[2];
  return words;
}
