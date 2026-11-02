# Rapport d'analyse en profondeur — Plateforme Globus BTP

> Audit exhaustif fichier par fichier : backend (FastAPI) + frontend (vitrine /
> espace-client / ERP). Objectif : recenser **tout** mockData / donnée par
> défaut / fallback statique, les duplications, les fonctionnalités CMS
> cassées, les zones partiellement dynamiques, les modules manquants et la
> couverture de tests.
>
> Périmètre analysé : 110 fichiers frontend (`.ts/.tsx`), 60 fichiers backend
> (`.py`). Date : 2026-05-31.

---

## 0. Synthèse exécutive

| Domaine | Verdict | Sévérité |
|---|---|---|
| Système de fallback mock global (`cms.api` + `useApiData`) | Présent, à neutraliser | 🔴 Haute |
| Fichiers mock (`home.mock.ts` + `pages.mock.ts`) | 1 670 lignes à retirer | 🔴 Haute |
| Fallbacks mock inline dans pages ERP | 13 pages, ~30 tableaux | 🔴 Haute |
| Charts hardcodés sans endpoint | 10 pages, ~18 datasets | 🟠 Moyenne |
| CMS non éditable (hero-video, cta-banner, etc.) | 4 types + 2 pages détail | 🟠 Moyenne |
| Modules sans backend (QHSE briefings, etc.) | 3 modules | 🟠 Moyenne |
| Couverture de tests | 53 backend / 8 frontend, 0 e2e | 🔴 Haute |

**Architecture confirmée saine** : la couche hooks React Query (`useErp.ts`,
1308 lignes) et la couche API backend sont **quasi exhaustives**. Le problème
n'est donc PAS un manque d'endpoints — c'est que les **pages** retombent sur
des tableaux mock locaux au lieu d'afficher un état vide, et que certains
graphiques ne sont câblés à aucun endpoint existant.

---

## 1. Le système de fallback mock (cœur du problème)

### 1.1 `services/api/cms.api.ts` — `fetchOrMock` / `postOrMock`
```ts
async function fetchOrMock<T>(endpoint, mockData): Promise<T> {
  if (!isApiConfigured()) {          // = VITE_API_URL absent
    await sleep(300);                // fake latence
    return mockData;                 // ← renvoie le MOCK
  }
  return (await axiosClient.get<T>(endpoint)).data;
}
```
- **26 fonctions** du site vitrine passent par ce helper (hero, services,
  projets, blog, FAQ, contact, légal, à-propos…).
- Quand `VITE_API_URL` n'est pas défini, **tout le site public sert du mock**.
- `isApiConfigured()` = `Boolean(envVars.VITE_API_URL)`.

### 1.2 `hooks/useApiData.ts` — **code mort à supprimer**
Hook qui institutionnalise le fallback (`data = apiReady && query.data ? query.data : fallback`).
**Défini mais importé nulle part** (vérifié par grep global). À supprimer.

### 1.3 Fichiers mock
| Fichier | Lignes | Contenu |
|---|---|---|
| `services/api/mockData/home.mock.ts` | 461 | hero, stats, projets, services, équipe, témoignages, partenaires, FAQ, blog |
| `services/api/mockData/pages.mock.ts` | 1 209 | pages services/projets détaillées, blog complet, FAQ, à-propos, légal, contact, settings |

### 1.4 Re-exports morts (gardent le mock vivant dans le bundle)
- `ServicesPage.tsx:18` → `export { mockServicesPageData as servicesData }`
- `ProjectsPage.tsx:18` → `export { mockProjectsPageData as projectsData }`
- `BlogPage.tsx:18` → `export { mockBlogPostsPageData as blogPostsData }`

---

## 2. Pages ERP — fallbacks mock inline (`return initialX` si API vide)

Pattern systématique :
```ts
const data = useMemo(() => {
  if (!Array.isArray(apiX) || apiX.length === 0) return initialX;  // ← MOCK
  return apiX.map(...)
}, [apiX]);
```

| Page | Tableaux mock à supprimer | Ligne(s) |
|---|---|---|
| `ErpSAV.tsx` | `mockTickets` | 55, 288 |
| `ErpQHSE.tsx` | `initialIncidents`, `initialEpiData`, `initialBriefings`¹ | 20, 72, 138 |
| `ErpPlanification.tsx` | `initialDailyTasks` | 139, 244 |
| `ErpCRM.tsx` | `initialPipelineColumns`, `initialQuotes`² | 30, 168 |
| `ErpAgenda.tsx` | `mockEvents` | 70, 233 |
| `ErpMateriel.tsx` | `initialEquipment`, `initialAssignments`, `initialMaintenanceUpcoming` | 21, 65, 97 |
| `ErpAchats.tsx` | `initialDemandes`, `initialBonsCommande`, `initialStockItems`, `initialMouvements` | 52, 99, 143, 187 |
| `ErpFinances.tsx` | `initialProjects`, `initialCharges`, `initialPettyTransactions` | 46, 160, 204 |
| `ErpChantiers.tsx` | `initialProjects`, `initialTeamAssignments`³ | 56, 193 |
| `ErpRH.tsx` | `initialEmployees`, `initialWorkers` | 56, 118 |
| `ErpParametres.tsx` | `defaultUsers` | 47, 179 |
| `ErpDocuments.tsx` | `templates` (fallback) | 22, 116 |
| `ErpNotifications.tsx` | `initialNotifications` | 30 |

¹ `initialBriefings` n'est PAS un fallback : c'est `useState(initialBriefings)` →
**100 % état local, aucun backend** (voir §5).
² `initialQuotes` (devis) : à relier au champ `leads.quote_amount` ou nouveau modèle.
³ `initialTeamAssignments` : pas d'endpoint d'affectation d'équipe par chantier.

---

## 3. Graphiques hardcodés (aucun endpoint — données 100 % statiques)

Ces datasets ne sont reliés à **aucune** source API. Certains backends existent
déjà (à câbler), d'autres nécessitent un nouvel endpoint.

| Page | Dataset | Endpoint backend |
|---|---|---|
| `ErpDashboard.tsx` | `expenseData` (pie répartition dépenses) | ❌ **À créer** `/reports/expense-breakdown` |
| `ErpDashboard.tsx` | `recentActivity` (fallback) | ✅ existe `/activity` |
| `ErpRapports.tsx` | `revenueData` | ✅ existe `/reports/revenue-by-month` |
| `ErpRapports.tsx` | `performanceData` | ❌ **À créer** `/reports/project-performance` |
| `ErpRapports.tsx` | `projectTypeData` | ❌ **À créer** `/reports/projects-by-type` |
| `ErpRapports.tsx` | `qhseData` | ✅ existe `/qhse/stats` |
| `ErpRH.tsx` | `timesheetData` | ✅ existe `/hr/attendance` (à agréger) |
| `ErpRH.tsx` | `payrollData` | ✅ existe `/hr/payroll` |
| `ErpFinances.tsx` | `cashFlowData` | ❌ **À créer** `/finances/cashflow` |
| `ErpFacturation.tsx` | `agingData` (balance âgée) | ❌ **À créer** `/invoices/stats/aging` |
| `ErpFacturation.tsx` | `relancesData` | ✅ dérivable de `/invoices?status=ENVOYEE` échues |
| `ErpChantiers.tsx` | `resourceData` | ❌ **À créer** `/projects/resource-allocation` |
| `ClientDashboard.tsx` | `budgetData` (fallback) | ✅ existe `/client/finances` |
| `ClientFinances.tsx` | `budgetEvolutionData` | ❌ **À créer** `/client/finances/evolution` |
| `ClientFinances.tsx` | `receiptsData` (reçus) | ❌ **À créer** `/client/finances/receipts` |
| `ClientPlanning.tsx` | `upcomingEvents` | ✅ dérivable de `/client/planning` (phases à venir) |
| `ClientChantier.tsx` | `timelineData`, `photosData` (fallback) | ✅ existent (`/client/project/timeline`, `/gallery`) |

---

## 4. CMS — fonctionnalités publiées mais non éditables

Le backend `admin_cms.py` couvre 18 types de contenu (blog, projets, services,
équipe, témoignages, partenaires, FAQ, hero-slides, engagements, méthodologie,
stats, garanties, settings, about, légal, contacts, média). **Manquent** :

| Type de contenu | Public (lecture) | Admin (CRUD) | Impact |
|---|---|---|---|
| `hero-video` | ✅ `/cms/hero-video` | ❌ | Vidéo héro non modifiable |
| `cta-banner` | ✅ `/cms/cta-banner` | ❌ | Bandeau CTA non modifiable |
| `ongoing-project` | ✅ `/cms/ongoing-project` | ❌ | Projet en cours (home) figé |
| `video-section` | ✅ `/cms/video-section` | ❌ | Section vidéo figée |
| `ServiceDetailFull` | ✅ `/cms/services/{slug}` | ❌ | Contenu riche page service = mock |
| `ProjectDetailFull` | ✅ `/cms/projects/{slug}` | ❌ | Contenu riche page projet = mock |

→ Dans `ErpCMS.tsx` (onglet « Accueil & Sections »), ces blocs sont soit absents,
soit rendus en lecture seule. `useAdminCMS.ts` ne fournit aucune mutation pour
eux. C'est la cause des « fonctionnalités CMS qui ne fonctionnent pas ».

---

## 5. Modules manquants / non gérés (aucun backend)

| Module | Localisation | État |
|---|---|---|
| **QHSE — Briefings sécurité** (toolbox talks) | `ErpQHSE.tsx:138,219` | `useState(initialBriefings)` — aucun modèle, aucun endpoint. CRUD 100 % local, perdu au refresh. |
| **Répartition dépenses par catégorie** | `ErpDashboard.tsx:67` | Pie chart statique. Pas d'agrégation backend. |
| **Reçus de paiement client** | `ClientFinances.tsx:118` | `receiptsData` mock. Les `Payment` existent mais pas d'endpoint « reçu PDF » côté client. |
| **Affectation d'équipe par chantier** | `ErpChantiers.tsx:193` | `initialTeamAssignments` mock. Pas de modèle `ProjectAssignment`. |
| **Devis CRM** | `ErpCRM.tsx:168` | `initialQuotes` mock. `leads.quote_amount` existe mais pas de modèle Devis complet (lignes, PDF). |

---

## 6. Duplications relevées

| Élément | Verdict |
|---|---|
| `ErpDocuments.tsx` vs `ErpGED.tsx` | **Pas** une duplication : Documents = générateur de modèles (templates), GED = coffre-fort documentaire par chantier. Clarifier le nommage/menu. |
| `useClient.ts` vs hooks client dans `useErp.ts` | **Duplication réelle** : `useErp.ts` (l.502-562) redéfinit `useClientProject/Finances/Documents/Messages/...` alors que `hooks/useClient.ts` est la source utilisée par les pages client. Les versions de `useErp` semblent orphelines → à supprimer. |
| `_now()` / `utcnow_naive()` | Helper dupliqué dans ~12 routers backend (`def _now()`) au lieu d'importer `app.utils.time.utcnow_naive`. |
| Fonction `fetchOrMock` vs `useApiData` vs `useCmsQuery` | 3 mécanismes de fetch concurrents pour la vitrine. À unifier sur `useCmsQuery` seul. |
| Formulaire « Nouveau Prospect » (ErpCRM) / « Lead » (ContactPage public) | Logique de création de lead dupliquée — mutualiser via `crmApi.createLead`. |

---

## 7. Pages partiellement dynamiques (récapitulatif par statut)

**✅ Entièrement dynamiques (propres)** : `ErpJournalActivite`, `ErpBureauEtudes`,
`ErpGED`, `ClientMessages`, `ClientNotifications`, `ClientAccount`,
`ClientSAV` (hors fallback), pages légales publiques, `ContactPage`, `AboutPage`,
`FAQPage`.

**🟠 Partiellement dynamiques (données réelles + fallback/chart mock)** :
`ErpDashboard`, `ErpRapports`, `ErpFacturation`, `ErpFinances`, `ErpRH`,
`ErpChantiers`, `ErpAchats`, `ErpMateriel`, `ErpCRM`, `ErpSAV`, `ErpAgenda`,
`ErpPlanification`, `ErpParametres`, `ErpDocuments`, `ClientDashboard`,
`ClientFinances`, `ClientChantier`, `ClientDocuments`.

**🔴 Faux-dynamiques (état local pur)** : onglet « Briefings » de `ErpQHSE`,
section « Reçus » de `ClientFinances`, « upcomingEvents » de `ClientPlanning`.

---

## 8. Couverture de tests actuelle

### Backend — 53 tests / 9 fichiers
✅ Couverts : `auth` (11), `crm` (4), `client_portal` (4), `collaboration` (5),
`realtime` (3), `health` (6), `2fa` (2), `documents_exports` (11),
`phase8_extra` (7).

❌ **Non couverts** : `invoicing`, `hr`, `ged`, `projects`, `equipment`,
`equipment_extra`, `subcontractors`, `sub_invoices`, `planning`, `charges`,
`epi`, `reports`, `templates`, `messaging`, `agenda`, `qhse`, `notifications`,
`user_prefs`, `admin_cms`, `public_cms`, `admin_media`.

### Frontend — 8 tests / 2 fichiers
✅ `downloads.test.ts` (5), `ExportButton.test.tsx` (3).

❌ **Manquants** :
- **Tests unitaires** : hooks (`useErp`, `useClient`, `useAdminCMS`, `useCmsQuery`), utils (iconRegistry, formatters).
- **Tests de composants** : EmptyState, Toast, Skeleton, ErrorBoundary, SigningOtpDialog, TempWorkerQrModal, formulaires.
- **Tests d'intégration** : flux page complet avec MSW (mock service worker) sur React Query.
- **Tests e2e** : aucun (ni Playwright ni Cypress). Parcours critiques non couverts : login → dashboard, création facture → PDF, signature OTP client, soumission contact vitrine.
- **Tests visuels / Chromatic** : aucun Storybook, aucune story, aucune intégration Chromatic.
- **Tests UI/a11y** : aucun (axe-core).

---

## 9. Inventaire des risques techniques annexes

1. **`fetchOrMock` masque les pannes API** : en prod, si `VITE_API_URL` est mal
   configuré, le site affiche silencieusement du mock au lieu d'une erreur.
2. **Seed backend incomplet** : `seed.py`/`seed_part2/3` ne sèment pas
   `hero-video`, `cta-banner`, `video-section`, `ongoing-project`, `testimonials`,
   `partners`, `stats`, `guarantees`, `methodology`, `team` → si on retire le mock
   frontend sans compléter le seed, ces sections seront vides.
3. **Helpers `_now()` dupliqués** : 12+ copies → risque d'incohérence fuseau.
4. **Hooks client dupliqués** entre `useErp.ts` et `useClient.ts`.
5. **`tsconfig` `noUnusedLocals: false`** masque le code mort (mock importés non
   utilisés, etc.).

---

## 10. Conclusion

Le socle est solide (API + hooks quasi complets, 8 phases livrées). Le travail
restant est un **chantier de "dé-mockage" systématique** en 3 volets :

1. **Neutraliser le fallback mock** (vitrine + ERP + client) → états vides +
   messages adaptés via `<EmptyState>`.
2. **Câbler ou créer les endpoints manquants** pour les graphiques et modules
   aujourd'hui statiques (expense-breakdown, cashflow, aging, briefings QHSE,
   reçus client, CMS hero-video/cta/video/ongoing).
3. **Bâtir la pyramide de tests** (unitaires → composants → intégration → e2e →
   visuels) backend et frontend.

Le détail séquencé figure dans `PLAN_IMPLEMENTATION.md`.
