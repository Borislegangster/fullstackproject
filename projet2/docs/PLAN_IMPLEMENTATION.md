# Plan d'implémentation — Dé-mockage & dynamisation totale

> Suite directe du `RAPPORT_ANALYSE_PROFONDE.md`. Objectif : **zéro mockData,
> zéro donnée par défaut, fallbacks vides avec messages adaptés**, endpoints
> manquants créés/câblés, et pyramide de tests complète (backend + frontend).
>
> Organisation en **9 phases** (P9 → P17), chacune livrable et testable
> indépendamment. Convention identique aux phases 0-8 déjà livrées.

---

## Principes directeurs

1. **Aucun fallback mock** : tout `if (length === 0) return initialX` devient
   un rendu `<EmptyState>` (composant déjà existant `components/ui/EmptyState.tsx`).
2. **Distinguer 3 états** sur chaque liste : `isLoading` → `<Skeleton>`,
   `isError` → `<ModuleErrorFallback>`, `data.length === 0` → `<EmptyState>`.
3. **Charts vides** : afficher un message « Aucune donnée sur la période » au
   lieu de barres/lignes factices.
4. **Ne jamais masquer une panne API** : retirer `fetchOrMock`, laisser l'erreur
   remonter au `<ErrorBoundary>` / toast.
5. **Compléter le seed** avant de retirer le mock pour ne pas vider la vitrine.

---

## PHASE 9 — Neutralisation du fallback mock vitrine (CMS public)

**Backend**
- [ ] Compléter `seed.py` : ajouter seed de `hero-video`, `cta-banner`,
  `video-section`, `ongoing-project`, `testimonials`, `partners`, `stats`,
  `guarantees`, `methodology`, `team` (données réelles Globus).

**Frontend**
- [ ] `cms.api.ts` : supprimer `fetchOrMock`/`postOrMock`, remplacer par appels
  `axiosClient` directs. Les 26 fonctions renvoient l'API ou *throw*.
- [ ] Supprimer les imports de `mockData/home.mock` et `mockData/pages.mock`.
- [ ] Supprimer les 3 re-exports morts (`ServicesPage`, `ProjectsPage`, `BlogPage`).
- [ ] Supprimer `hooks/useApiData.ts` (code mort).
- [ ] `useCmsQuery` : ajouter état vide + `isLoading` propre dans chaque page
  vitrine (`ServicesPage`, `ProjectsPage`, `BlogPage`, `BlogDetailPage`,
  `ServiceDetailPage`, `ProjectDetailPage`, `FAQPage`, `AboutPage`).
- [ ] **Supprimer** `services/api/mockData/home.mock.ts` + `pages.mock.ts` (1 670 l.).

**Tests** : `test_public_cms.py` (tous les GET renvoient le seed) + Vitest
`cms.api.test.ts` (mock axios, vérifie URL + propagation d'erreur).

---

## PHASE 10 — CMS admin : éditeurs manquants

**Backend** (`admin_cms.py` + `cms_service.py` + schémas)
- [ ] CRUD `hero-video` (PUT singleton).
- [ ] CRUD `cta-banner` (PUT singleton).
- [ ] CRUD `video-section` (PUT singleton).
- [ ] CRUD `ongoing-project` (PUT singleton).
- [ ] CRUD complet `ServiceDetailFull` (sections, specs, galerie).
- [ ] CRUD complet `ProjectDetailFull` (sections, specs, galerie, avant/après).

**Frontend**
- [ ] `admin.api.ts` + `useAdminCMS.ts` : ajouter `heroVideoApi`, `ctaBannerApi`,
  `videoSectionApi`, `ongoingProjectApi`, `serviceDetailApi`, `projectDetailApi`.
- [ ] `ErpCMS.tsx` onglet « Accueil & Sections » : brancher les éditeurs
  hero-video / cta-banner / video-section / ongoing-project.
- [ ] `ErpCMS.tsx` onglets Services/Portfolio : éditeur de page détail riche.

**Tests** : `test_admin_cms.py` (CRUD des 6 nouveaux types, RBAC admin).

---

## PHASE 11 — Endpoints analytics/charts manquants (backend)

**Backend — nouveaux endpoints**
- [ ] `GET /reports/expense-breakdown` (répartition dépenses par catégorie).
- [ ] `GET /reports/project-performance` (avancement vs budget par chantier).
- [ ] `GET /reports/projects-by-type` (répartition par type de projet).
- [ ] `GET /finances/cashflow` (entrées/sorties mensuelles).
- [ ] `GET /invoices/stats/aging` (balance âgée 0-30/30-60/60-90/90+).
- [ ] `GET /projects/resource-allocation` (charge ressources/équipes).
- [ ] `GET /hr/attendance/summary` (agrégat pointage par période).
- [ ] `GET /client/finances/evolution` (évolution budget client).
- [ ] `GET /client/finances/receipts` (reçus de paiement du client).

**Tests** : `test_reports.py`, `test_invoicing.py` (aging), `test_finances.py`.

---

## PHASE 12 — Dé-mockage ERP partie 1 (finances, facturation, dashboard, rapports)

Pour chaque page : supprimer le tableau mock, câbler le hook réel, ajouter
`<EmptyState>` + skeleton + gestion d'erreur, brancher les charts sur les
endpoints P11.

- [ ] `ErpDashboard.tsx` : `expenseData`→`/reports/expense-breakdown`,
  `recentActivity`→`/activity`, supprimer fallback `profitData`.
- [ ] `ErpRapports.tsx` : `revenueData`, `performanceData`, `projectTypeData`,
  `qhseData` → endpoints réels.
- [ ] `ErpFacturation.tsx` : `agingData`→`/invoices/stats/aging`,
  `relancesData`→ factures échues réelles.
- [ ] `ErpFinances.tsx` : `cashFlowData`→`/finances/cashflow`,
  supprimer `initialProjects/Charges/PettyTransactions`.

**Tests** : Vitest composants (chart vide → message), `test_invoicing.py` étendu.

---

## PHASE 13 — Dé-mockage ERP partie 2 (RH, chantiers, achats, matériel)

- [ ] `ErpRH.tsx` : supprimer `initialEmployees/Workers`, `timesheetData`
  (→ `/hr/attendance/summary`), `payrollData` (→ `/hr/payroll`).
- [ ] `ErpChantiers.tsx` : supprimer `initialProjects`, `resourceData`
  (→ `/projects/resource-allocation`) ; créer modèle+endpoint **affectation
  d'équipe** pour remplacer `initialTeamAssignments`.
- [ ] `ErpAchats.tsx` : supprimer `initialDemandes/BonsCommande/StockItems/Mouvements`.
- [ ] `ErpMateriel.tsx` : supprimer `initialEquipment/Assignments/MaintenanceUpcoming`.

**Tests** : `test_hr.py`, `test_projects.py`, `test_procurement.py` (étendu),
`test_equipment.py`.

---

## PHASE 14 — Dé-mockage ERP partie 3 (CRM, SAV, agenda, planification, QHSE, paramètres)

- [ ] `ErpCRM.tsx` : supprimer `initialPipelineColumns` ; **modèle Devis**
  (Quote) backend + endpoints pour remplacer `initialQuotes`.
- [ ] `ErpSAV.tsx` : supprimer `mockTickets`.
- [ ] `ErpAgenda.tsx` : supprimer `mockEvents`.
- [ ] `ErpPlanification.tsx` : supprimer `initialDailyTasks`.
- [ ] `ErpQHSE.tsx` : supprimer `initialIncidents/EpiData` ; **modèle
  SafetyBriefing** backend + CRUD pour remplacer `initialBriefings` (toolbox talks).
- [ ] `ErpParametres.tsx` : supprimer `defaultUsers`.
- [ ] `ErpDocuments.tsx` / `ErpNotifications.tsx` : supprimer fallbacks.

**Tests** : `test_crm.py` (devis), `test_qhse.py` (briefings), `test_sav.py`,
`test_agenda.py`, `test_planning.py`.

---

## PHASE 15 — Dé-mockage espace client

- [ ] `ClientDashboard.tsx` : supprimer fallback `budgetData`.
- [ ] `ClientFinances.tsx` : `budgetEvolutionData`→`/client/finances/evolution`,
  `receiptsData`→`/client/finances/receipts` (+ génération reçu PDF).
- [ ] `ClientChantier.tsx` : supprimer fallbacks `timelineData/photosData`.
- [ ] `ClientPlanning.tsx` : `upcomingEvents`→ phases à venir réelles.
- [ ] `ClientDocuments.tsx` : supprimer `initialDocumentsData`.
- [ ] `ClientMessages.tsx` : supprimer `initialConversations/MessagesData`.
- [ ] `ClientSAV.tsx` : supprimer `initialTickets`.

**Tests** : `test_client_portal.py` étendu (finances/receipts/evolution).

---

## PHASE 16 — Nettoyage dette & duplications

- [ ] Supprimer les hooks client dupliqués dans `useErp.ts` (l.502-562).
- [ ] Centraliser `_now()` → `app.utils.time.utcnow_naive` dans les 12 routers.
- [ ] Réactiver `tsconfig` `noUnusedLocals/noUnusedParameters: true` puis purger.
- [ ] Mutualiser la création de lead (ContactPage public ↔ ErpCRM).
- [ ] Audit final grep : `mock`, `initial`, `default`, `fake`, `sample` = 0 hit
  hors `/test`.

---

## PHASE 17 — Pyramide de tests complète

### 17.1 Backend (pytest) — viser ~90 % endpoints
- [ ] `test_invoicing.py`, `test_hr.py`, `test_ged.py`, `test_projects.py`,
  `test_equipment.py`, `test_subcontractors.py`, `test_planning.py`,
  `test_charges.py`, `test_epi.py`, `test_reports.py`, `test_templates.py`,
  `test_messaging.py`, `test_agenda.py`, `test_qhse.py`, `test_notifications.py`,
  `test_user_prefs.py`, `test_admin_cms.py`, `test_public_cms.py`,
  `test_admin_media.py`.
- [ ] Couverture `pytest-cov` + seuil CI ≥ 80 %.

### 17.2 Frontend — tests unitaires & composants (Vitest + Testing Library)
- [ ] Hooks : `useErp`, `useClient`, `useAdminCMS`, `useCmsQuery` (avec **MSW**).
- [ ] Composants : `EmptyState`, `Toast`, `Skeleton`, `ErrorBoundary`,
  `ModuleErrorFallback`, `SigningOtpDialog`, `TempWorkerQrModal`, `ExportButton`.
- [ ] Formulaires : contact vitrine, création lead, création facture.

### 17.3 Tests d'intégration (MSW + render page complète)
- [ ] Parcours rendu : chaque page ERP/client monte, affiche skeleton →
  données → état vide selon le mock MSW.

### 17.4 Tests e2e (Playwright)
- [ ] Installer Playwright + config CI (backend + frontend en docker-compose).
- [ ] Scénarios : login ERP → dashboard ; création facture → téléchargement PDF ;
  signature OTP client ; soumission formulaire contact vitrine → lead CRM ;
  upload document → partage client.

### 17.5 Tests visuels / Chromatic (Storybook)
- [ ] Installer Storybook + stories pour le design system (`ui/*`, `EmptyState`,
  `Toast`, boutons, cartes KPI, charts vides).
- [ ] Intégration **Chromatic** (snapshot visuel) dans la CI sur PR.

### 17.6 Tests a11y/UI
- [ ] `@axe-core/playwright` sur les pages clés (login, dashboard, contact).

### 17.7 CI
- [ ] Étendre `.github/workflows/ci.yml` : jobs `pytest-cov`, `vitest`,
  `playwright`, `chromatic`.

---

## Récapitulatif des nouveaux artefacts backend

**Modèles** : `SafetyBriefing`, `ProjectAssignment`, `Quote` (+ `QuoteLine`).
**Endpoints** : 9 analytics (P11) + 6 CMS singletons/détail (P10) + briefings/devis/affectations (P13-14) + reçus client (P15).
**Seed** : complété pour 10 types CMS manquants.

## Récapitulatif des suppressions frontend

- 2 fichiers mock (1 670 lignes), 1 hook mort (`useApiData`),
  ~30 tableaux `initialX/mockX` inline, 3 re-exports morts,
  hooks client dupliqués dans `useErp`.

## Ordre d'exécution recommandé

P9 (vitrine) → P10 (CMS admin) → P11 (endpoints charts) → P12-13-14 (ERP) →
P15 (client) → P16 (nettoyage) → P17 (tests). Chaque phase se termine par
`pytest` + `tsc` + `vitest` + `vite build` verts.
