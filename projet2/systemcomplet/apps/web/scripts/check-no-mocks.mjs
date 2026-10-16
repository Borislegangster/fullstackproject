#!/usr/bin/env node
/**
 * V4-DEPLOY-42 — aucun mock, aucune donnée fictive dans le code livré en production.
 * Contrôle le code applicatif web (src/) et API (backend/app/) ; les tests, seeders et scripts de démo sont hors
 * périmètre (ils ne sont jamais chargés par l'application ; le seeder de démo app/seeds/demo.py refuse de tourner en
 * production et est retiré de l'image Docker de production). Code de sortie 1 en cas de violation (exécuté en CI).
 *
 *  1. bibliothèques de simulation importées par le code applicatif (msw, faker, miragejs, unittest.mock…) ;
 *  2. identifiants / textes de simulation (mock, fake, dummy, lorem ipsum, « données de démo ») ;
 *  3. dépendances de simulation déclarées comme dépendances de production (package.json, requirements.txt) ;
 *  4. drapeaux d'environnement de simulation (NEXT_PUBLIC_*MOCK*, USE_MOCK…).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(WEB, "..", "..");
const BACKEND = join(ROOT, "backend");

function walk(dir, accept, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (["node_modules", "__pycache__", ".next", "generated"].includes(name) || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, accept, out);
    else if (accept(name)) out.push(path);
  }
  return out;
}

const MOCK_LIBS = ["msw", "@mswjs/data", "miragejs", "json-server", "nock", "@faker-js/faker", "faker", "casual", "chance", "pretender", "sinon"];
const PY_MOCK_LIBS = ["faker", "factory_boy", "factory-boy", "mimesis", "responses", "respx", "freezegun", "pytest", "mock"];

const RULES = [
  { re: /\bfrom\s+["'](?:msw|msw\/\w+|@mswjs\/[\w-]+|miragejs|json-server|nock|@faker-js\/faker|faker|casual|chance|pretender|sinon)["']/, why: "bibliothèque de simulation importée" },
  { re: /\b(?:import|from)\s+(?:unittest\.mock|mock|faker|factory|mimesis|responses|respx|freezegun)\b/, why: "bibliothèque de simulation importée", py: true },
  { re: /\b(?:Magic|Async)?Mock\s*\(|\bjest\.(?:mock|fn)\b|\bvi\.(?:mock|fn)\b/, why: "objet de simulation" },
  { re: /\b(?:mock|mocked|mocks|fake|faked|fakes|dummy)(?:[A-Z_]\w*)?\b/i, why: "identifiant ou texte de simulation" },
  { re: /\b\w+(?:Mock|Fake|Dummy)\w*\b|\b\w+_(?:mock|fake|dummy)\w*\b/, why: "identifiant de simulation" },
  { re: /lorem\s+ipsum|dolor\s+sit\s+amet/i, why: "texte de remplissage" },
  { re: /donn[ée]es?\s+(?:de\s+)?(?:d[ée]mo|fictives?|factices?|bidon)|sample\s+data|placeholder\s+data/i, why: "données fictives" },
  { re: /\b(?:NEXT_PUBLIC_\w*(?:MOCK|FAKE|DUMMY)\w*|USE_MOCKS?|MOCK_API|ENABLE_MOCKS?)\b/, why: "drapeau de simulation" },
];

/** Seeders de démonstration : hors code de production (garde ENV + exclusion de l'image). */
const SEEDERS = [join("backend", "app", "seeds", "demo.py")];

const violations = [];
function scan(file, isPython) {
  const rel = relative(ROOT, file);
  if (SEEDERS.includes(rel)) return;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.py && !isPython) continue;
        if (rule.re.test(line)) {
          violations.push({ where: `${rel}:${i + 1}`, why: rule.why, line: line.trim().slice(0, 160) });
          break;
        }
      }
    });
}

for (const file of walk(join(WEB, "src"), (n) => /\.(tsx?|jsx?|mjs|css)$/.test(n))) scan(file, false);
for (const file of walk(join(BACKEND, "app"), (n) => n.endsWith(".py"))) scan(file, true);

/* dépendances de production */
const pkg = JSON.parse(readFileSync(join(WEB, "package.json"), "utf8"));
for (const dep of Object.keys(pkg.dependencies ?? {})) {
  if (MOCK_LIBS.includes(dep)) violations.push({ where: "apps/web/package.json", why: "dépendance de simulation en production", line: dep });
}
try {
  readFileSync(join(BACKEND, "requirements.txt"), "utf8")
    .split("\n")
    .forEach((line, i) => {
      const name = line.trim().split(/[<>=!~;[\s]/)[0].toLowerCase();
      if (name && !name.startsWith("#") && PY_MOCK_LIBS.includes(name)) {
        violations.push({ where: `backend/requirements.txt:${i + 1}`, why: "dépendance de simulation en production", line: line.trim() });
      }
    });
} catch {
  /* dépôt web seul */
}

if (violations.length) {
  console.error(`✖ V4-DEPLOY-42 : ${violations.length} élément(s) de simulation dans le code de production :`);
  for (const v of violations) console.error(`  ${v.where}  [${v.why}]  ${v.line}`);
  process.exit(1);
}
console.log("✔ V4-DEPLOY-42 : aucun mock ni donnée fictive dans le code de production (web + API).");
