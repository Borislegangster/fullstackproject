#!/usr/bin/env node
/**
 * Inventaire de TOUS les formulaires de l'interface web, tels que l'utilisateur les voit : écran (menu et adresse),
 * bouton qui ouvre le formulaire, titre de la fenêtre, champs dans l'ordre d'affichage (libellé exact, obligatoire,
 * type de saisie, choix proposés), bouton d'enregistrement.
 *
 * Sert de référence à la recette (docs/RECETTE.md) : `node scripts/forms-inventory.mjs` écrit docs/FORMULAIRES.md.
 * Lit le code (arbre syntaxique TypeScript) et les schémas générés depuis l'API : aucune donnée inventée.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import ts from "typescript";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(WEB, "..", "..");
const OUT = join(ROOT, "docs", "FORMULAIRES.md");

// --------------------------------------------------------------------------- libellés réels (lib/labels.ts)
const tmp = join(WEB, ".forms-inventory");
mkdirSync(tmp, { recursive: true });
for (const name of ["format", "labels", "refs"]) {
  const code = readFileSync(join(WEB, "src/lib", `${name}.ts`), "utf8");
  let js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  js = js.replace(/from "\.\/(\w+)"/g, 'from "./$1.mjs"');
  writeFileSync(join(tmp, `${name}.mjs`), js);
}
const labels = await import(pathToFileURL(join(tmp, "labels.mjs")).href);
const refsMod = await import(pathToFileURL(join(tmp, "refs.mjs")).href);
const { fieldLabel, optionLabel } = labels;
const { FIELD_REFS, LIST_REFS = {}, REFS } = refsMod;

const src = readFileSync(join(WEB, "src/generated/schemas.ts"), "utf8");
const grab = (name) => Function(`return ${src.match(new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`))[1]}`)();
const SCHEMAS = grab("SCHEMAS");
const BODIES = grab("BODIES");

const REF_NAMES = {
  projects: "projets",
  sites: "sites du projet",
  lots: "lots du projet",
  phases: "phases du projet",
  milestones: "jalons du projet",
  tasks: "tâches du projet",
  zones: "zones de la maquette",
  suppliers: "fournisseurs",
  subcontractors: "sous-traitants",
  stockItems: "articles de stock",
  supplierProducts: "produits fournisseurs",
  warehouses: "entrepôts",
  locations: "emplacements de l'entrepôt",
  employees: "employés",
  teams: "équipes",
  users: "utilisateurs",
  organizations: "organisations",
  clientOrganizations: "organisations clientes",
  supplierOrganizations: "organisations de type fournisseur",
  subcontractorOrganizations: "organisations de type sous-traitant",
  contacts: "contacts",
  opportunities: "opportunités",
  leads: "leads",
  equipment: "matériels",
  goodsReceipts: "réceptions",
  purchaseOrders: "bons de commande",
  subcontracts: "marchés",
  bankAccounts: "comptes bancaires",
  universes: "univers",
  folders: "dossiers GED",
  ppeItems: "EPI",
  inspectionTemplates: "grilles d'inspection",
  maintenancePlans: "plans de maintenance",
  materialCategories: "catégories de matériaux",
  materials: "matériaux",
  tenders: "consultations",
  supplierInvoices: "factures fournisseurs",
  supplierCreditNotes: "avoirs fournisseurs",
  clientInvoices: "factures clients",
  workSchedules: "horaires",
  roles: "rôles",
  segments: "segments",
  emailTemplates: "modèles d'e-mail",
};
const refName = (key) => (key ? `liste des ${REF_NAMES[key] ?? key}` : "liste");

// Contrôles personnalisés connus : description de la saisie pour un non-technicien.
const CUSTOM = {
  RolePicker: "cases à cocher : rôles",
  PersonTradeSelect: "liste des métiers",
  TradesPicker: "cases à cocher : corps de métier (par famille)",
  DisciplinesPicker: "cases à cocher : disciplines",
  MultiRefSelect: "sélection multiple dans une liste",
  RefSelect: "liste à choisir",
  UploadedFileField: "dépôt d'un fichier (photo ou PDF)",
  OfferSelect: "liste des offres du site",
  DecisionOptionsEditor: "options proposées (bouton « Option »)",
  DecisionReferenceField: "pièce concernée (liste selon le type)",
  TenderDocsPicker: "cases à cocher : documents GED du projet",
  MediaPicker: "choix dans la médiathèque",
  TriggerConfigEditor: "réglage du déclencheur",
  StepsEditor: "étapes (bouton « Étape »)",
  RowsEditor: "tableau de lignes (bouton d'ajout)",
  CheckGroup: "cases à cocher",
  ScoresEditor: "notes par critère",
  BracketsEditor: "tranches (bouton d'ajout)",
  WeekdaysPicker: "jours de la semaine",
  DateListInput: "liste de dates",
  ImmersiveFileField: "fichier : photo/vidéo du chantier, document GED ou nouveau fichier",
  ValueEditor: "valeur structurée",
  TagInput: "mots-clés (taper puis Entrée)",
  LabelListEditor: "liste de libellés",
};

// --------------------------------------------------------------------------- fichiers et composants
const files = [];
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) {
      if (!["generated", "node_modules"].includes(n)) walk(p);
    } else if (/\.tsx$/.test(n)) files.push(p);
  }
};
walk(join(WEB, "src"));

const sources = new Map();
const parse = (file) => {
  if (!sources.has(file)) sources.set(file, ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
  return sources.get(file);
};
const rel = (f) => relative(ROOT, f).replace(/\\/g, "/");
const text = (n) => (n ? n.getText().replace(/\s+/g, " ").trim() : "");
const literal = (n) => {
  if (!n) return null;
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) return n.getText().slice(1, -1).replace(/\$\{[^}]*\}/g, "…");
  if (ts.isJsxExpression(n)) return literal(n.expression);
  if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n)) return literal(n.expression);
  return null;
};

// Déclarations de variables par fichier (résolution de `fields: SUPPLIER_FIELDS`, `opts(CONTRACTS)`…).
const declsOf = new Map();
const declarations = (sf) => {
  if (!declsOf.has(sf)) {
    const list = [];
    const visit = (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) list.push(n);
      ts.forEachChild(n, visit);
    };
    visit(sf);
    declsOf.set(sf, list);
  }
  return declsOf.get(sf);
};
const resolveId = (n, sf, at) => {
  let e = n;
  for (let guard = 0; e && guard < 6; guard++) {
    while (e && (ts.isAsExpression(e) || ts.isParenthesizedExpression(e) || ts.isSatisfiesExpression?.(e))) e = e.expression;
    if (!e || !ts.isIdentifier(e)) return e;
    const name = e.text;
    const cands = declarations(sf).filter((d) => d.name.text === name);
    const before = cands.filter((d) => d.getStart() < (at ?? Infinity));
    let d = (before.length ? before : cands).at(-1);
    if (!d) {
      // Valeur importée d'un autre fichier (`import { personTradeField } from "@/components/…"`).
      const imp = sf.statements.find((st) => ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings) && st.importClause.namedBindings.elements.some((el) => el.name.text === name));
      const spec = imp && literal(imp.moduleSpecifier);
      if (spec && spec.startsWith("@/")) {
        const base = join(WEB, "src", spec.slice(2));
        const target = [`${base}.tsx`, `${base}.ts`].find((x) => { try { return statSync(x).isFile(); } catch { return false; } });
        if (target) {
          const other = parse(target);
          d = declarations(other).filter((x) => x.name.text === name).at(-1);
          if (d) sf = other;
        }
      }
    }
    if (!d) return e;
    e = d.initializer;
  }
  return e;
};
const propsOf = (obj, sf) => {
  const o = resolveId(obj, sf);
  const out = new Map();
  if (!o) return out;
  if (ts.isObjectLiteralExpression(o)) {
    for (const p of o.properties) {
      if (ts.isPropertyAssignment(p)) out.set(p.name.getText().replace(/["']/g, ""), p.initializer);
      else if (ts.isShorthandPropertyAssignment(p)) out.set(p.name.getText(), resolveId(p.name, sf));
      else if (ts.isSpreadAssignment(p)) for (const [k, v] of propsOf(p.expression, sf)) out.set(k, v);
    }
  } else if (ts.isArrowFunction(o) || ts.isFunctionExpression(o)) {
    // fields: (row) => ({ … })
    let body = o.body;
    while (body && ts.isParenthesizedExpression(body)) body = body.expression;
    if (body && ts.isObjectLiteralExpression(body)) return propsOf(body, sf);
  }
  return out;
};
const stringArray = (n, sf) => {
  const e = resolveId(n, sf);
  if (e && ts.isArrayLiteralExpression(e)) return e.elements.map((x) => literal(x) ?? (ts.isArrayLiteralExpression(x) ? literal(x.elements[0]) : null)).filter((x) => x !== null);
  return null;
};

// Choix d'une configuration `options` : opts([...]), [...].map(...), tableau de { value, label }.
const optionsOf = (n, sf) => {
  let e = resolveId(n, sf);
  if (!e) return null;
  if (ts.isCallExpression(e)) {
    const callee = e.expression.getText();
    if (callee === "opts" || callee.endsWith("Options")) {
      const arr = stringArray(e.arguments[0], sf);
      if (arr) return arr.map((v) => optionLabel(v));
      // opts(LIST.filter(...)) : la liste d'origine
      const inner = e.arguments[0];
      if (inner && ts.isCallExpression(inner) && ts.isPropertyAccessExpression(inner.expression)) {
        const base = stringArray(inner.expression.expression, sf);
        if (base) return base.map((v) => optionLabel(v));
      }
      return null;
    }
    if (ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === "map") {
      const arr = stringArray(e.expression.expression, sf);
      if (arr) return arr.map((v) => optionLabel(v));
    }
  }
  if (ts.isArrayLiteralExpression(e)) {
    const out = [];
    for (const el of e.elements) {
      if (ts.isObjectLiteralExpression(el)) {
        const p = propsOf(el, sf);
        out.push(literal(p.get("label")) ?? literal(p.get("value")) ?? "…");
      } else if (literal(el)) out.push(optionLabel(literal(el)));
    }
    return out.length ? out : null;
  }
  return null;
};

// Contrôle rendu par `render: (...) => <X …/>` : nom du composant.
const renderedTag = (n) => {
  let found = null;
  const visit = (x) => {
    if (found) return;
    if (ts.isJsxSelfClosingElement(x) || ts.isJsxOpeningElement(x)) found = x.tagName.getText();
    ts.forEachChild(x, visit);
  };
  visit(n);
  return found;
};

// --------------------------------------------------------------------------- champs d'un formulaire généré
function describeKind(def, cfg, sf) {
  if (cfg.render) {
    const tag = renderedTag(cfg.render);
    if (CUSTOM[tag]) return CUSTOM[tag];
    const body = cfg.render.getText();
    if (/type="checkbox"|<Checkbox/.test(body)) {
      const names = [...body.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
      return names.length ? `cases à cocher : ${names.join(" · ")}` : "cases à cocher";
    }
    return tag ? `saisie dédiée (${tag})` : "saisie dédiée";
  }
  // Règles génériques du moteur de formulaires (schema-form.tsx) : devise, couleur, discipline.
  if (def.kind === "string" && !cfg.options && !cfg.widget) {
    if (def.name === "currency") return "liste : FCFA (XAF) · Euro (EUR) · Dollar US (USD)";
    if (/(^|_)color(_hex)?$/.test(def.name)) return "sélecteur de couleur";
    if (/^discipline(_a|_b)?$/.test(def.name)) return "liste des disciplines (Hub BIM)";
  }
  const opts = cfg.options ? optionsOf(cfg.options, sf) : null;
  if (opts) return `liste : ${opts.join(" · ")}`;
  if (cfg.options) return "liste de choix";
  if (cfg.widget === "tags") return CUSTOM.TagInput;
  if (cfg.widget === "textarea") return "texte long";
  if (def.kind === "enum") return `liste : ${(def.options ?? []).map((o) => optionLabel(o)).join(" · ")}`;
  if (def.kind === "uuid") {
    const r = cfg.ref ? (literal(cfg.ref) ?? text(cfg.ref).match(/REFS\.(\w+)/)?.[1]) : FIELD_REFS[def.name];
    return refName(r);
  }
  if (def.kind === "list" && def.itemKind === "uuid") return `sélection multiple : ${refName(LIST_REFS[def.name])}`;
  if (def.kind === "list") return def.itemOptions?.length ? `cases à cocher : ${def.itemOptions.map((o) => optionLabel(o)).join(" · ")}` : CUSTOM.TagInput;
  const k = {
    string: "texte",
    text: "texte long",
    email: "adresse e-mail",
    integer: "nombre entier",
    number: "nombre",
    boolean: "case à cocher",
    date: "date",
    datetime: "date et heure",
    time: "heure",
    file: "fichier à déposer",
    files: "fichiers à déposer",
    objects: "tableau de lignes",
    object: "bloc de champs",
    json: "réglage structuré",
  }[def.kind];
  const bounds = [];
  if (def.maxLength && ["string", "text"].includes(def.kind)) bounds.push(`${def.maxLength} car. max`);
  if (def.minLength && def.minLength > 1) bounds.push(`${def.minLength} car. min`);
  if (def.min !== undefined) bounds.push(`≥ ${def.min}`);
  if (def.max !== undefined) bounds.push(`≤ ${def.max}`);
  return `${k ?? def.kind}${bounds.length ? ` (${bounds.join(", ")})` : ""}`;
}

function generatedFields(endpoint, form, sf) {
  const body = form.schema ? { schema: form.schema, type: "json" } : BODIES[endpoint];
  const defs = body ? SCHEMAS[body.schema] ?? [] : [];
  const cfgs = propsOf(form.fields, sf);
  const fixed = new Set([...propsOf(form.fixed, sf).keys()]);
  const exclude = new Set(stringArray(form.exclude, sf) ?? []);
  const only = stringArray(form.only, sf);
  const order = stringArray(form.order, sf);
  let list = defs.filter((d) => !endpoint.includes(`{${d.name}}`) && !fixed.has(d.name) && !exclude.has(d.name));
  if (only) list = only.map((n) => list.find((d) => d.name === n)).filter(Boolean);
  if (order) {
    const rank = (n) => (order.indexOf(n) === -1 ? order.length : order.indexOf(n));
    list = [...list].sort((a, b) => rank(a.name) - rank(b.name));
  }
  const rows = [];
  for (const def of list) {
    const c = propsOf(cfgs.get(def.name), sf);
    const cfg = Object.fromEntries(c);
    if (cfg.hidden && cfg.hidden.kind === ts.SyntaxKind.TrueKeyword) continue;
    // Identifiant sans liste ni rendu dédié : jamais présenté (champ technique).
    if (def.kind === "uuid" && !cfg.render && !cfg.options && !cfg.ref && !FIELD_REFS[def.name]) continue;
    if (def.kind === "list" && def.itemKind === "uuid" && !cfg.render && !cfg.ref && !LIST_REFS[def.name]) continue;
    if ((def.kind === "json" || (def.kind === "list" && ["json", "object"].includes(def.itemKind))) && !cfg.render && !cfg.widget) continue;
    const label = literal(cfg.label) ?? fieldLabel(def.name);
    const conditional = cfg.visibleIf ? " (affiché seulement si : condition)" : "";
    rows.push({
      label,
      required: (def.required && def.kind !== "boolean") || !!cfg.requiredIf,
      conditional: !!cfg.visibleIf,
      kind: describeKind(def, cfg, sf) + conditional,
      help: literal(cfg.help) ?? def.help ?? "",
      sub: def.kind === "objects" && def.ref ? (SCHEMAS[def.ref] ?? []).map((s) => `${fieldLabel(s.name)}${s.required && s.kind !== "boolean" ? " ★" : ""}`) : null,
    });
  }
  return { rows, multipart: body?.type === "multipart", known: !!body };
}

// --------------------------------------------------------------------------- formulaires écrits à la main
function handFields(fn, sf) {
  const rows = [];
  const visit = (n) => {
    if ((ts.isJsxElement(n) && n.openingElement.tagName.getText() === "Field") || (ts.isJsxSelfClosingElement(n) && n.tagName.getText() === "Field")) {
      const open = ts.isJsxElement(n) ? n.openingElement : n;
      const attrs = Object.fromEntries(open.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(), a.initializer]));
      const label = literal(attrs.label) ?? (attrs.label ? text(attrs.label).replace(/^\{|\}$/g, "") : "");
      const required = "required" in attrs && (!attrs.required || text(attrs.required) !== "{false}");
      let kind = "saisie";
      if (ts.isJsxElement(n)) {
        let child = null;
        const KNOWN = new Set(["Input", "Textarea", "Select", "RefSelect", "FileDrop", "Checkbox", ...Object.keys(CUSTOM)]);
        const find = (x) => {
          if (child) return;
          if ((ts.isJsxSelfClosingElement(x) || ts.isJsxOpeningElement(x)) && KNOWN.has(x.tagName.getText())) child = x;
          ts.forEachChild(x, find);
        };
        n.children.forEach(find);
        if (child) {
          const tag = child.tagName.getText();
          const ca = Object.fromEntries(child.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(), a.initializer]));
          if (tag === "Input") {
            const type = literal(ca.type) ?? "text";
            kind = { number: "nombre", date: "date", "datetime-local": "date et heure", email: "adresse e-mail", tel: "téléphone", password: "mot de passe", time: "heure", month: "mois" }[type] ?? "texte";
          } else if (tag === "Textarea") kind = "texte long";
          else if (tag === "Select") {
            const o = ca.options ? optionsOf(ts.isJsxExpression(ca.options) ? ca.options.expression : ca.options, sf) : null;
            kind = o ? `liste : ${o.join(" · ")}` : "liste de choix";
          } else if (tag === "RefSelect") kind = refName(text(ca.source).match(/REFS\.(\w+)/)?.[1]);
          else if (tag === "FileDrop") kind = "fichier(s) à déposer";
          else kind = CUSTOM[tag] ?? `saisie dédiée (${tag})`;
        }
      }
      rows.push({ label, required, kind, help: literal(attrs.help) ?? "" });
      return;
    }
    if (ts.isJsxSelfClosingElement(n) && n.tagName.getText() === "Checkbox") {
      const attrs = Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(), a.initializer]));
      const label = literal(attrs.label);
      if (label) rows.push({ label, required: false, kind: "case à cocher", help: "" });
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return rows;
}
const buttonsOf = (fn) => {
  const out = [];
  const visit = (n) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === "Button") {
      const t = n.children
        .map((c) => (ts.isJsxText(c) ? c.getText() : ts.isJsxExpression(c) && c.expression ? (literal(c.expression) ?? (ts.isConditionalExpression(c.expression) ? `${literal(c.expression.whenTrue) ?? "…"} / ${literal(c.expression.whenFalse) ?? "…"}` : "")) : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (t) out.push(t);
    }
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return [...new Set(out)];
};
const modalTitles = (fn) => {
  const out = [];
  const visit = (n) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ["Modal", "Drawer", "ConfirmDialog"].includes(n.tagName.getText())) {
      const t = n.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === "title");
      const v = t && literal(t.initializer);
      if (v) out.push(v);
    }
    ts.forEachChild(n, visit);
  };
  visit(fn);
  return out;
};

// --------------------------------------------------------------------------- composants → écrans
// Clé d'un composant : « Nom@fichier » (plusieurs pages ont une fonction locale « Inner ») ; page : « page:/route ».
const pageRoute = (file) => {
  const page = rel(file).match(/apps\/web\/src\/app\/(.*)\/page\.tsx$/);
  return page ? "/" + page[1].replace(/\([^)]*\)\/?/g, "").replace(/\/$/, "") : null;
};
const isComponent = (n) =>
  (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) ||
  (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^[A-Z]/.test(n.name.text) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer)));
const keyOf = (n) => {
  if (ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && pageRoute(n.getSourceFile().fileName)) return `page:${pageRoute(n.getSourceFile().fileName)}`;
  return `${n.name.text}@${rel(n.getSourceFile().fileName)}`;
};
const fnOf = new Map(); // clé → { file, node, name, route? }
const rawUses = new Map(); // clé → [{ tag, file }]
for (const f of files) {
  const sf = parse(f);
  const visit = (n, owner) => {
    let cur = owner;
    if (isComponent(n) || (ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && pageRoute(f))) {
      cur = keyOf(n);
      if (!fnOf.has(cur)) fnOf.set(cur, { file: f, node: n, name: n.name?.text ?? cur, route: cur.startsWith("page:") ? cur.slice(5) : null });
    }
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && cur) {
      const tag = n.tagName.getText();
      if (/^[A-Z]/.test(tag)) {
        if (!rawUses.has(cur)) rawUses.set(cur, []);
        rawUses.get(cur).push({ tag, file: f });
      }
    }
    ts.forEachChild(n, (c) => visit(c, cur));
  };
  visit(sf, null);
}
const byName = new Map();
for (const [key, info] of fnOf) {
  if (key.startsWith("page:")) continue;
  if (!byName.has(info.name)) byName.set(info.name, []);
  byName.get(info.name).push(key);
}
const resolveTag = (tag, file) => {
  const local = `${tag}@${rel(file)}`;
  if (fnOf.has(local)) return local;
  const cands = (byName.get(tag) ?? []).filter((k) => fnOf.get(k).node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || ts.isVariableDeclaration(fnOf.get(k).node));
  return cands[0] ?? null;
};
const usesOf = new Map();
for (const [key, list] of rawUses) usesOf.set(key, new Set(list.map((u) => resolveTag(u.tag, u.file)).filter(Boolean)));
// Écrans (routes) qui affichent chaque composant ; distance = composants traversés (le plus proche = écran principal).
const routesOf = new Map();
for (const [key, info] of fnOf) {
  if (!info.route) continue;
  const dist = new Map([[key, 0]]);
  const queue = [key];
  while (queue.length) {
    const cur = queue.shift();
    for (const u of usesOf.get(cur) ?? []) {
      if (!dist.has(u)) {
        dist.set(u, dist.get(cur) + 1);
        queue.push(u);
      }
    }
  }
  for (const [comp, d] of dist) {
    if (!routesOf.has(comp)) routesOf.set(comp, new Map());
    const m = routesOf.get(comp);
    if (!m.has(info.route) || m.get(info.route) > d) m.set(info.route, d);
  }
}
// Menus de l'ERP (app/erp/layout.tsx) : adresse → « Section › Entrée ».
const menu = new Map();
{
  const layout = readFileSync(join(WEB, "src/app/erp/layout.tsx"), "utf8");
  let section = "";
  for (const line of layout.split("\n")) {
    const t = line.match(/title: "([^"]+)"/);
    if (t) section = t[1];
    const m = line.match(/href: "([^"]+)", label: "([^"]+)"/);
    if (m) menu.set(m[1], section ? `${section} › ${m[2]}` : m[2]);
  }
}
const menuOf = (route) => {
  const best = [...menu.keys()].filter((h) => route === h || route.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  return best ? menu.get(best) : null;
};
const ownerOf = (node) => {
  let n = node;
  while (n) {
    if (isComponent(n) || (ts.isFunctionDeclaration(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) && pageRoute(n.getSourceFile().fileName))) return keyOf(n);
    n = n.parent;
  }
  return null;
};
const shortName = (key) => (key ? key.split("@")[0] : "?");
const whereOf = (owner) => {
  const m = routesOf.get(owner) ?? new Map();
  const routes = [...m.keys()].sort((a, b) => m.get(a) - m.get(b) || a.localeCompare(b));
  return routes.map((r) => (menuOf(r) ? `${menuOf(r)} (\`${r}\`)` : `\`${r}\``));
};

// --------------------------------------------------------------------------- collecte
const forms = [];
for (const f of files) {
  const sf = parse(f);
  const visit = (n) => {
    // ResourceView : objet de configuration avec title + create / update / actions
    if (ts.isObjectLiteralExpression(n)) {
      const p = propsOf(n, sf);
      const title = literal(p.get("title"));
      if (title && (p.has("create") || p.has("update") || p.has("actions")) && p.has("path")) {
        const owner = ownerOf(n);
        const base = { file: rel(f), owner, list: title };
        if (p.has("create")) {
          const c = propsOf(p.get("create"), sf);
          const endpoint = literal(c.get("endpoint"));
          const label = literal(c.get("label")) ?? "Nouveau";
          if (endpoint) forms.push({ ...base, kind: "create", endpoint, button: label, dialog: literal(c.get("label")) ?? `Nouveau — ${title}`, submit: "Créer", ...generatedFields(endpoint, { fields: c.get("fields"), exclude: c.get("exclude"), fixed: c.get("fixed"), order: c.get("order") }, sf) });
        }
        if (p.has("update")) {
          const u = propsOf(p.get("update"), sf);
          const endpoint = literal(u.get("endpoint"));
          if (endpoint) forms.push({ ...base, kind: "update", endpoint, button: "Modifier (dans la fiche ouverte depuis la liste)", dialog: "fiche de l'élément", submit: "Enregistrer", ...generatedFields(endpoint, { fields: u.get("fields"), exclude: u.get("exclude"), order: u.get("order") }, sf) });
        }
        const actions = resolveId(p.get("actions"), sf);
        if (actions && ts.isArrayLiteralExpression(actions)) {
          for (const a of actions.elements) {
            const ap = propsOf(a, sf);
            const label = literal(ap.get("label")) ?? "Action";
            const endpoint = literal(ap.get("endpoint"));
            const body = endpoint ? BODIES[endpoint] : null;
            if (endpoint && body?.schema) {
              forms.push({ ...base, kind: "action", endpoint, button: `${label} (dans la fiche)`, dialog: label, submit: label, ...generatedFields(endpoint, { fields: ap.get("fields") }, sf) });
            } else {
              const reason = literal(ap.get("reasonLabel"));
              forms.push({ ...base, kind: "confirm", endpoint: endpoint ?? text(ap.get("path")).slice(0, 80), button: `${label} (dans la fiche)`, dialog: `confirmation${reason ? ` — ${reason}` : ""}`, submit: "Confirmer", rows: reason ? [{ label: reason, required: true, kind: "texte long", help: "" }] : [], known: true });
            }
          }
        }
      }
    }
    // <SchemaForm endpoint="…" />
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText() === "SchemaForm") {
      const attrs = Object.fromEntries(n.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(), a.initializer && ts.isJsxExpression(a.initializer) ? a.initializer.expression : a.initializer]));
      const schemaName = literal(attrs.schema);
      const endpoint = literal(attrs.endpoint) ?? (schemaName ? `schéma ${schemaName}` : null);
      if (endpoint) {
        // Fenêtre englobante
        let dialog = null;
        let x = n.parent;
        while (x && !dialog) {
          if (ts.isJsxElement(x) && ["Modal", "Drawer"].includes(x.openingElement.tagName.getText())) {
            const t = x.openingElement.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === "title");
            dialog = (t && literal(t.initializer)) ?? "fenêtre";
          }
          x = x.parent;
        }
        forms.push({ file: rel(f), owner: ownerOf(n), kind: "form", endpoint, button: null, dialog: dialog ?? "formulaire dans la page", submit: literal(attrs.submitLabel) ?? "Enregistrer", ...generatedFields(endpoint, { fields: attrs.fields, exclude: attrs.exclude, fixed: attrs.fixed, only: attrs.only, order: attrs.order, schema: literal(attrs.endpoint) ? null : schemaName }, sf) });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
// Formulaires écrits à la main : composants qui enregistrent (api POST/PUT/PATCH) et affichent des champs <Field>.
for (const [name, info] of fnOf) {
  if (info.route) continue;
  const body = info.node.getText();
  if (!/method:\s*"(POST|PUT|PATCH)"|form:\s*(fd|form)\b/.test(body)) continue;
  if (!/<Field\b|<Checkbox\b/.test(body)) continue;
  const sf = info.node.getSourceFile();
  const rows = handFields(info.node, sf);
  if (!rows.length) continue;
  forms.push({ file: rel(info.file), owner: name, kind: "hand", endpoint: (body.match(/api(?:<[^>]*>)?\(\s*[`"]([^`"]+)[`"]\s*,\s*\{\s*method:\s*"(POST|PUT|PATCH)"/) ?? [])[1] ?? "", button: null, dialog: modalTitles(info.node).join(" / ") || "formulaire", submit: buttonsOf(info.node).join(" · "), rows, known: true });
}

// --------------------------------------------------------------------------- sortie
const sectionOf = (form) => {
  const where = whereOf(form.owner);
  if (where.length) return where[0];
  return `(composant ${shortName(form.owner)} — ${form.file})`;
};
const groups = new Map();
for (const form of forms) {
  const key = sectionOf(form);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(form);
}
const KIND = { create: "Création", update: "Modification", action: "Action", confirm: "Action avec confirmation", form: "Formulaire", hand: "Formulaire" };
let md = `# Inventaire des formulaires de la plateforme GLOBUS\n\n`;
md += `> Généré automatiquement depuis le code (\`node apps/web/scripts/forms-inventory.mjs\`) — ne pas modifier à la main.\n`;
md += `> Chaque formulaire : où il se trouve, le bouton qui l'ouvre, le titre de la fenêtre, puis ses champs **dans l'ordre affiché**, avec leur libellé exact. **Oui** = champ obligatoire (marqué d'un astérisque rouge à l'écran).\n\n`;
md += `${forms.length} formulaires.\n\n`;
for (const [section, list] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
  md += `## ${section}\n\n`;
  for (const form of list) {
    const head = form.kind === "hand" || form.kind === "form" ? form.dialog : `${form.list ? `${form.list} — ` : ""}${KIND[form.kind]}`;
    md += `### ${head}\n\n`;
    const bits = [];
    if (form.button) bits.push(`Bouton **${form.button}**`);
    if (form.dialog && form.kind !== "hand" && form.kind !== "form") bits.push(`fenêtre « ${form.dialog} »`);
    if (form.submit) bits.push(`validation : **${form.submit}**`);
    if (form.endpoint) bits.push(`\`${form.endpoint}\``);
    bits.push(`composant \`${shortName(form.owner)}\``);
    const where = whereOf(form.owner);
    md += `${bits.join(" · ")}${where.length > 1 ? `\n\nAussi dans : ${where.slice(1).join(", ")}` : ""}\n\n`;
    if (!form.rows?.length) {
      md += `_Aucun champ à saisir (confirmation simple)._\n\n`;
      continue;
    }
    md += `| # | Champ | Obligatoire | Saisie | Aide affichée |\n| --- | --- | --- | --- | --- |\n`;
    form.rows.forEach((r, i) => {
      const kind = r.sub ? `${r.kind} : ${r.sub.join(", ")}` : r.kind;
      md += `| ${i + 1} | ${r.label.replace(/\|/g, "/")} | ${r.required ? "**Oui**" : ""} | ${kind.replace(/\|/g, "/")} | ${(r.help ?? "").replace(/\|/g, "/").replace(/\n/g, " ")} |\n`;
    });
    md += `\n`;
  }
}
writeFileSync(OUT, md);
console.log(`✔ ${forms.length} formulaires inventoriés → ${rel(OUT)}`);
