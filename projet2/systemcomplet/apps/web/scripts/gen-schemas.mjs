#!/usr/bin/env node
/**
 * Génère src/generated/schemas.ts à partir du schéma OpenAPI de l'API GLOBUS.
 *
 * Les formulaires de l'ERP sont construits à partir de ces définitions : ils restent ainsi alignés sur les
 * validations serveur (champs requis, longueurs, énumérations, types), sans duplication manuelle.
 *
 *   1. python backend/scripts/export_openapi.py        (écrit apps/web/.openapi.json)
 *   2. node scripts/gen-schemas.mjs [chemin_openapi]   (écrit src/generated/schemas.ts)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const input = resolve(process.argv[2] ?? `${root}/.openapi.json`);
const output = resolve(root, "src/generated/schemas.ts");
const spec = JSON.parse(readFileSync(input, "utf8"));
const components = spec.components?.schemas ?? {};

/** Fichier téléversé : `format: binary` (OpenAPI 3.0) ou `contentMediaType` (OpenAPI 3.1, FastAPI ≥ 0.116). */
const isBinary = (schema) => schema?.type === "string" && (schema.format === "binary" || typeof schema.contentMediaType === "string");

const LONG_TEXT = new Set(
  (
    "description notes content body justification comment summary message terms introduction answer text reason html " +
    "report diagnosis resolution findings activities issues needs transcript bio challenge solution promise exclusions " +
    "technical_spec mitigation contingency coverage address condition_notes safety_notes access_instructions " +
    "immediate_actions root_cause injuries visitors deliveries_summary prospect_wants ideal_for quote edited_text " +
    "client_summary decision_summary verification_notes reviewer_note closure_note field_check_notes rejection_reason " +
    "variant_description lost_reason introduction equipment response question preheader transcript"
  ).split(/\s+/),
);

const refName = (ref) => ref.split("/").pop();

function unwrap(schema) {
  // anyOf [X, null] → X nullable ; anyOf [number, string] → décimal
  if (!schema) return { schema: {}, nullable: false };
  if (schema.allOf && schema.allOf.length === 1) return unwrap({ ...schema, ...schema.allOf[0], allOf: undefined });
  if (schema.anyOf) {
    const variants = schema.anyOf.filter((v) => v.type !== "null");
    const nullable = variants.length !== schema.anyOf.length;
    if (variants.length === 1) {
      const inner = unwrap(variants[0]);
      return { schema: { ...variants[0], ...inner.schema, title: schema.title, default: schema.default }, nullable };
    }
    const types = variants.map((v) => v.type).sort().join(",");
    if (types === "number,string" || types === "integer,string") {
      const num = variants.find((v) => v.type !== "string");
      return { schema: { ...num, type: "decimal", title: schema.title, default: schema.default }, nullable };
    }
    if (variants.some((v) => v.$ref)) {
      return { schema: { ...variants.find((v) => v.$ref), title: schema.title }, nullable };
    }
    return { schema: { type: "json", title: schema.title, default: schema.default }, nullable };
  }
  return { schema, nullable: false };
}

function enumFrom(schema) {
  if (Array.isArray(schema.enum)) return schema.enum.map(String);
  const m = typeof schema.pattern === "string" ? schema.pattern.match(/^\^\(([^()]+)\)\$$/) : null;
  if (m && !/[\\[\]*+?{}.]/.test(m[1])) return m[1].split("|");
  return undefined;
}

function kindOf(name, schema) {
  if (schema.$ref) return { kind: "object", ref: refName(schema.$ref) };
  const options = enumFrom(schema);
  if (options) return { kind: "enum", options };
  switch (schema.type) {
    case "boolean":
      return { kind: "boolean" };
    case "integer":
      return { kind: "integer" };
    case "number":
    case "decimal":
      return { kind: "number" };
    case "array": {
      const items = unwrap(schema.items).schema;
      if (items.$ref) return { kind: "objects", ref: refName(items.$ref) };
      if (isBinary(items)) return { kind: "files" };
      const inner = kindOf(name, items);
      return { kind: "list", itemKind: inner.kind, itemOptions: inner.options };
    }
    case "object":
    case "json":
      return { kind: "json" };
    case "string": {
      if (schema.format === "uuid") return { kind: "uuid" };
      if (schema.format === "date") return { kind: "date" };
      if (schema.format === "date-time") return { kind: "datetime" };
      if (schema.format === "email") return { kind: "email" };
      if (isBinary(schema)) return { kind: "file" };
      if (schema.format === "time") return { kind: "time" };
      if ((schema.maxLength ?? 0) >= 1000 || (!schema.maxLength && LONG_TEXT.has(name))) return { kind: "text" };
      return { kind: "string" };
    }
    default:
      return { kind: "json" };
  }
}

function fieldsOf(name) {
  const def = components[name];
  if (!def || !def.properties) return [];
  const required = new Set(def.required ?? []);
  return Object.entries(def.properties).map(([field, raw]) => {
    const { schema, nullable } = unwrap(raw);
    const info = kindOf(field, schema);
    const out = { name: field, kind: info.kind };
    if (required.has(field)) out.required = true;
    if (nullable) out.nullable = true;
    if (info.options) out.options = info.options;
    if (info.ref) out.ref = info.ref;
    if (info.itemKind) out.itemKind = info.itemKind;
    if (info.itemOptions) out.itemOptions = info.itemOptions;
    const source = schema.type === "array" ? schema : schema;
    if (source.maxLength !== undefined) out.maxLength = source.maxLength;
    if (source.minLength !== undefined) out.minLength = source.minLength;
    if (source.minimum !== undefined) out.min = source.minimum;
    if (source.exclusiveMinimum !== undefined) out.min = source.exclusiveMinimum;
    if (source.maximum !== undefined) out.max = source.maximum;
    if (raw.maxItems !== undefined || schema.maxItems !== undefined) out.maxItems = raw.maxItems ?? schema.maxItems;
    if (raw.minItems !== undefined || schema.minItems !== undefined) out.minItems = raw.minItems ?? schema.minItems;
    const dflt = raw.default !== undefined ? raw.default : schema.default;
    if (dflt !== undefined && dflt !== null && !(Array.isArray(dflt) && dflt.length === 0)) out.default = dflt;
    if (raw.description) out.help = raw.description;
    return out;
  });
}

const bodies = {};
const used = new Set();
function visit(name) {
  if (!components[name] || used.has(name)) return;
  used.add(name);
  for (const raw of Object.values(components[name].properties ?? {})) {
    const refs = JSON.stringify(raw).match(/#\/components\/schemas\/[A-Za-z0-9_]+/g) ?? [];
    refs.forEach((r) => visit(refName(r)));
  }
}

for (const [path, ops] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(ops)) {
    const content = op.requestBody?.content;
    if (!content) continue;
    const [type, media] = Object.entries(content)[0];
    const { schema } = unwrap(media.schema);
    const short = path.replace(/^\/api\/v1/, "");
    const key = `${method.toUpperCase()} ${short}`;
    if (schema.$ref) {
      const name = refName(schema.$ref);
      visit(name);
      bodies[key] = { type: type.startsWith("multipart") ? "multipart" : "json", schema: name };
    } else {
      bodies[key] = { type: type.startsWith("multipart") ? "multipart" : "json", schema: null };
    }
  }
}

const schemas = {};
for (const name of [...used].sort()) schemas[name] = fieldsOf(name);

const header = `// Fichier généré par scripts/gen-schemas.mjs depuis le schéma OpenAPI de l'API — ne pas modifier à la main.

export type FieldKind =
  | "string" | "text" | "number" | "integer" | "boolean" | "date" | "datetime" | "time" | "uuid" | "enum"
  | "email" | "list" | "objects" | "object" | "json" | "file" | "files";

export interface FieldDef {
  name: string;
  kind: FieldKind;
  required?: boolean;
  nullable?: boolean;
  options?: string[];
  ref?: string;
  itemKind?: FieldKind;
  itemOptions?: string[];
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  maxItems?: number;
  minItems?: number;
  default?: unknown;
  help?: string;
}

export interface BodyDef {
  type: "json" | "multipart";
  schema: string | null;
}
`;

const lines = (record) =>
  Object.entries(record)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join("\n");

mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  `${header}
export const SCHEMAS: Record<string, FieldDef[]> = {
${lines(schemas)}
};

export const BODIES: Record<string, BodyDef> = {
${lines(bodies)}
};
`,
);
console.log(`schemas.ts : ${Object.keys(schemas).length} schémas, ${Object.keys(bodies).length} corps de requête`);
