# Rapport d'analyse — état dynamique réel, page par page

> Après la passe de dé-mockage complète (Phase 18). **`grep` mock/données par
> défaut = 0** sur tout `frontend/src` (hors `/test` et placeholders d'exemple).
> Légende : ✅ entièrement dynamique · 🟡 dynamique avec fonctionnalité sans
> endpoint backend (état vide adapté) · 🔧 handler encore simulé (setTimeout).

---

## 1. Vitrine publique (`/`)

| Page / route | Source de données | État |
|---|---|---|
| `HomePage` (`/`) + sections (Hero, Services, Projects, Stats, Testimonials, Partners, About, FAQ, CTA, Video, Methodology, Engagements, Guarantees) | `useCmsQuery` → `/cms/*` (P9) | ✅ tout via CMS ; fallback = erreur remontée, pas de mock |
| `ServicesPage` / `ServiceDetailPage` | `getServices`, `getServiceBySlug`, `getContactInfo` | ✅ — boutons Appeler/WhatsApp affichés **seulement si** la donnée existe (plus de `+33…`) |
| `ProjectsPage` / `ProjectDetailPage` | `getProjects`, `getProjectBySlug` | ✅ |
| `BlogPage` / `BlogDetailPage` | `getAllBlogPosts`, `getBlogPostBySlug` | ✅ |
| `AboutPage`, `FAQPage`, `ContactPage` | `/cms/*`, `submitContactForm` (→ aussi lead CRM, P16) | ✅ |
| `HelpCenterPage` | `getContactInfo` | ✅ — email fallback vidé |
| Légales (`Legal/Privacy/Terms/Cookie`) | `getLegalPage` | ✅ |
| `Header` / `Footer` | `useCmsQuery('site-settings')` | ✅ — téléphone/email/adresse/horaires **rendus conditionnellement** (P17/P18, plus aucun défaut `+33`) |
| `SchemaOrg` (SEO JSON-LD) | `siteSettings` | ✅ — fallbacks contact vidés |

---

## 2. Espace client (`/espace-client/*`)

| Page | Hooks (`useClient*`) | État |
|---|---|---|
| `ClientDashboard` | `useClientProject`, `useClientFinances`, `useClientProjectLive`, `useClientUser` | ✅ — adresse codée en dur retirée ; `useClientUser` tire le vrai projet (P16) |
| `ClientChantier` | `useClientProject*` (timeline, galerie) | ✅ |
| `ClientPlanning` | `useClientPlanning` | ✅ — « chef de projet » générique (nom réel non exposé) · 🔧 quelques actions contact simulées |
| `ClientDocuments` | `useClientDocuments` | ✅ — carte « validé par Jean Talla » supprimée ; sélecteur employés réel · 🟡 choix matériaux = feature sans endpoint |
| `ClientMessages` | `useClientMessages`, `useSendClientMessage` | ✅ envoi réel · libellé chef générique |
| `ClientNotifications` | `useClientNotifications`, `useMarkClientNotificationRead` | ✅ — **tableau mock module supprimé + fallback `return []`** |
| `ClientSAV` | `useClientSAVTickets`, création/notation réelles | ✅ |
| `ClientAccount` | `useClientUser`, `useClientProfile`, 2FA panel | ✅ — identité réelle (`{clientUser.name}`) · 🔧 save profil simulé |
| `ClientFinances` | `useClientFinances`, `useClientFinancesEvolution/Receipts`, `useInitiatePayment` | ✅ paiement réel · 🔧 reset état UI |

---

## 3. ERP (`/erp/*`)

| Page | Sources réelles | État |
|---|---|---|
| `ErpDashboard` | `useDashboardStats/Alerts`, `useMarginByProject`, `useExpenseBreakdown`, `useProjects`, `useActivityLogs` | ✅ — bloc « Responsable : Ing. Mbarga / 08:30 » supprimé |
| `ErpChantiers` | `useProjects`, `team-assignments`, `resource-allocation` | ✅ — **timeline mock → vraies phases projet** (état vide si absentes) |
| `ErpFacturation` | `useInvoices`, `useQuotes`, `useProjects`, `useUsers` | ✅ — **Appels de Fonds = vraies factures `APPEL_FONDS` + budget calculé** ; modals Facture/Devis sur données réelles ; create/send/delete/relance branchés |
| `ErpFinances` | `useFinancesProjects`, `useCharges`, `usePettyCash`, `useCashflow` | ✅ — options chantier réelles (corrige aussi un bug `project_id`) |
| `ErpRapports` | `useReports*`, `useScheduledReports` | ✅ — modal rapport planifié + toggle/suppression branchés (P16) |
| `ErpCRM` | `useLeads`, `useCreate/Convert/Delete Lead`, `useQuotes` | ✅ — **onglet « Portail » mock (doublon Messagerie/Agenda) → état vide** ; convert/delete branchés |
| `ErpSAV` | `useSAVTickets`, `useProjects`, `useEmployees`, `useUsers` | ✅ — garanties/avis mock → états vides ; **selects client/projet/technicien réels + `name=` manquants corrigés** (bug create) |
| `ErpSousTraitants` | `useSubcontractors`, `useSubcontractorInvoices` | ✅ — **3 tableaux mock module supprimés + fallbacks `return []`** ; factures réelles ; onglet situations (sans endpoint) → état vide ; notation re-câblée |
| `ErpAchats` | `usePurchaseRequests/Orders`, `useStock*`, `useProjects` | ✅ — options projet réelles ; fournisseur = champ libre (pas d'endpoint fournisseurs) ; create/delete/receive branchés (P16) |
| `ErpMateriel` | `useEquipment`, `useEquipmentAssignments`, `useMaintenance`, `useProjects` | ✅ — **historique maintenance mock → vraies interventions terminées** ; options chantier réelles |
| `ErpGED` | `useProjects`, `useDocuments` | ✅ — **`planCategories` mock + fallback supprimés → arbre `liveCategories` dérivé des vrais documents** |
| `ErpQHSE` | `useIncidents`, `useEPIData`, `useBriefings`, `useProjects` | ✅ — 3 listes d'options projet codées en dur → réelles |
| `ErpPlanification` | `usePlanningTasks`, `useProjects` | ✅ — **Gantt mock `ganttTasks` → dérivé des vraies tâches** ; titre + selects réels |
| `ErpDocuments` | `useDocumentTemplates`, `useGeneratedDocuments`, `useEmployees` | ✅ — listes employés réelles |
| `ErpAgenda` | `useEvents`, `useCreateEvent`, `useConfirmAppointment` | ✅ (P16) · ⚠️ calendrier ancré « Mars 2026 » (mois de référence statique, non donnée métier) |
| `ErpJournalActivite` | `useActivityLogs` | ✅ — mock `activityLog` supprimé (P16) |
| `ErpBureauEtudes` | hooks BIM/collab | ✅ |
| `ErpRH` | `useEmployees`, `useTempWorkers`, `useAttendance`, `usePayroll*` | ✅ — actions delete/pointage/paie branchées (P16) ; options = enums RH légitimes |
| `ErpParametres` | `useUsers` + CRUD réel | ✅ utilisateurs réels (P16) · 🟡 onglet « Entreprise » = **doublon des réglages CMS** : valeurs codées vidées, à brancher sur `updateSettings` (dédup recommandée) · 🔧 save entreprise/rôles/reset simulés |
| `ErpCMS` | `useAdminCMS` (auth via env, plus de creds en dur) | ✅ éditeurs branchés (P10/P16) |
| `ErpNotifications` | `useNotifications` | ✅ (P16) |

---

## Points de suivi (gaps honnêtes, hors « mock data »)

1. **Features sans endpoint backend** (rendues en état vide adapté, à créer côté API si besoin) : situations de travaux sous-traitants, garanties/avis SAV, choix de matériaux client, historique d'interventions sous-traitant.
2. **Handlers encore simulés (`setTimeout`)** sans mutation : `handleSaveCompany`/`handleSaveRoles`/`handleResetSystem` (Paramètres), quelques actions de contact côté client. Aucune **donnée** mock — uniquement de la fonctionnalité à finaliser.
3. **Dédup** : onglet « Entreprise » (Paramètres) recouvre les réglages société du CMS → à fusionner.
4. **`ErpAgenda`** : calendrier figé sur Mars 2026 (mois de référence) — à rendre relatif au mois courant.
5. **Endpoints fournisseurs / clients-prospects** : `fournisseur` et certains `client_name` sont en saisie libre (datalist) faute d'endpoint dédié.

## Validation
- `npx tsc --noEmit` : **0 erreur**
- `npx vite build` : **OK**
- `vitest run` : **42 tests** ✅
- `grep` données mock/par défaut (noms, lieux, contacts) : **0** sur tout `src`
