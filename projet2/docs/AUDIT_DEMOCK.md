# Audit de dé-mockage complet — Globus BTP

> Objectif (strict) : **aucune donnée mock, par défaut ou codée en dur** ne doit
> subsister dans une page, un composant, un layout ou un fallback. Tout doit être
> branché à l'API ; les fallbacks doivent être **vides avec un message adapté**.

## Pourquoi la passe précédente (Phase 16) a échoué

L'audit Phase 16 s'appuyait sur `noUnusedLocals` + des greps `const mockX = [...]`.
Ça **ne détecte pas** :
- les **tableaux littéraux rendus en ligne** dans le JSX (`{[ {…}, {…} ].map()}`) ;
- le **texte métier codé en dur** (`M. Jean Talla`, `85 000 000 FCFA`, dates) ;
- les **`<option>` codés en dur** au lieu d'être alimentés par un hook ;
- les **handlers factices** `setTimeout(() => showToast(...))` sans mutation réelle.

Cette passe (Phase 18) corrige la méthode : scan par signatures métier
(noms propres, montants, options, handlers factices) **fichier par fichier**.

## Matrice de sévérité (occurrences détectées)

| Fichier | noms | montants | handlers factices | tableaux inline | options dures |
|---|--:|--:|--:|--:|--:|
| erp/ErpGED.tsx | 23 | 0 | qqs | 0 | 0 |
| erp/ErpQHSE.tsx | 17 | 0 | 0 | 1 | 0 |
| erp/ErpSAV.tsx | 10 | 0 | qqs | 1 | 27 |
| erp/ErpPlanification.tsx | 9 | 0 | 0 | 0 | 3 |
| erp/ErpSousTraitants.tsx | 8 | 0 | qqs | 3 | 9 |
| erp/ErpCRM.tsx | 8 | 1 | qqs | 0 | 0 |
| erp/ErpAchats.tsx | 8 | 0 | 0 | 0 | 0 |
| erp/ErpFinances.tsx | 7 | 0 | 0 | 0 | 0 |
| erp/ErpFacturation.tsx | 5 | 3 | qqs | 1 | 4 |
| erp/ErpDocuments.tsx | 4 | 0 | qqs | 0 | 4 |
| erp/ErpMateriel.tsx | 3 | 0 | qqs | 0 | 0 |
| erp/ErpParametres.tsx | 1 | 0 | qqs | 0 | 10 |
| erp/ErpAgenda.tsx | 2 | 0 | qqs | 2 | 0 |
| erp/ErpDashboard.tsx | 1 | 0 | qqs | 0 | 0 |
| erp/ErpChantiers.tsx | 1 | 0 | 0 | 0 | 0 |
| erp/ErpJournalActivite.tsx | 0 | 0 | qqs | 0 | 2 |
| erp/ErpCMS(Modals).tsx | 1 | 0 | qqs | 7 | 0 |
| erp/ErpRH.tsx | 0 | 0 | qqs | 2 | 17 |
| erp/ErpRapports.tsx | 0 | 0 | qqs | 0 | 0 |
| erp/ErpBureauEtudes.tsx | 0 | 0 | 0 | 1 | 0 |
| client/ClientSAV.tsx | 0 | 0 | qqs | 2 | 6 |
| client/ClientChantier.tsx | 0 | 0 | 0 | 0 | 3 |
| client/ClientPlanning.tsx | 3 | 0 | qqs | 0 | 0 |
| client/ClientNotifications.tsx | 2 | 2 | 0 | 0 | 0 |
| client/ClientDocuments.tsx | 1 | 1 | qqs | 1 | 0 |
| client/ClientMessages.tsx | 1 | 0 | qqs | 0 | 0 |
| client/ClientDashboard.tsx | 1 | 1 | qqs | 0 | 0 |
| client/ClientAccount.tsx | 0 | 0 | qqs | 0 | 2 |
| client/ClientFinances.tsx | 0 | 0 | qqs | 0 | 0 |
| home/StatsBar, Testimonials | 0 | 0 | 0 | 1 | 0 |
| layout/Header, Footer | (corrigé) | | | | |

> « qqs » = à inspecter (certains `setTimeout` sont légitimes : auto-dismiss toast,
> délais d'animation, simulation de progression de téléchargement → conservés).

## Règles de tri

- **SUPPRIMER + brancher** : données métier (clients, projets, factures, tickets,
  documents, montants, dates, échéanciers, appels de fonds…).
- **CONSERVER** : structure UI (définitions d'onglets, variantes d'animation,
  maps d'icônes, libellés d'enum de statut, liens de navigation).
- **CÂBLER** : handlers `setTimeout(...showToast)` simulant une action → mutation réelle.
- **FALLBACK VIDE** : `return []` + `<EmptyState>` / message adapté (jamais de défaut).

## Backend — endpoints disponibles vs manquants

- Factures / appels de fonds : `GET /invoices` (filtrer `invoice_type === 'APPEL_FONDS'`). ✅
- Clients (pour les `<option>`) : à exposer côté ERP (`GET /admin/users?role=CLIENT`
  ou réutiliser `useUsers`). À vérifier par page.
- Le reste (CRM, SAV, RH, achats, matériel, planning, GED, QHSE, finances) :
  hooks `useErp` déjà existants — il s'agit de **brancher l'affichage**, pas
  d'écrire des endpoints (sauf gaps ponctuels identifiés en cours de route).

## Plan d'exécution (par vagues, vérif tsc+build+tests après chaque vague)

1. **ERP facturation/finances** : ErpFacturation (appels de fonds + modals devis),
   ErpFinances, ErpRapports.
2. **ERP métier 1** : ErpCRM, ErpSAV, ErpSousTraitants, ErpAchats, ErpMateriel.
3. **ERP métier 2** : ErpGED, ErpQHSE, ErpPlanification, ErpBureauEtudes,
   ErpDocuments, ErpJournalActivite, ErpAgenda, ErpChantiers, ErpDashboard,
   ErpParametres, ErpRH, ErpCMS(Modals).
4. **Espace client** : ClientDashboard, ClientChantier, ClientPlanning,
   ClientDocuments, ClientMessages, ClientNotifications, ClientSAV, ClientAccount,
   ClientFinances.
5. **Vitrine + layouts** : Header (fait), Footer, StatsBar, TestimonialsSection,
   AuthLayout, AboutSection, HeroSection, PortfolioSection, BlogDetailPage.
6. **Duplications** : factoriser formulaires/`<option>` clients-projets partagés.
7. **Tests** : étendre pytest + Vitest/MSW + e2e + stories pour les pages recâblées.

Chaque vague : `npx tsc --noEmit` = 0, `vite build` OK, `vitest run` + `pytest` verts.

---

## Phase 19+ — Dé-mockage des handlers factices & données multi-lignes (TERMINÉ)

La passe single-line avait laissé passer des données métier **réparties sur
plusieurs lignes** et des **handlers `setTimeout` factices**. Audit multi-lignes
+ signatures métier → tout corrigé :

### Handlers factices → opérations réelles
- **Exports CSV réels** (données chargées) : `ErpJournalActivite`, `ErpSAV`,
  `ErpRapports` (rapports prédéfinis + export manuel par module → `/exports/*.xlsx`).
- **Téléchargements réels** (`utils/download.ts` : blob authentifié + barre de
  progression réelle) : `ErpDocuments`, `ErpGED`, `ClientDocuments`,
  `ClientFinances` (PDF facture `/invoices/{id}/pdf`).
- **GED réel** : nouveaux endpoints `POST /ged/documents/upload`,
  `POST /ged/documents/{id}/version-upload`, `DELETE /ged/documents/{id}` +
  modale d'upload câblée (fichier, projet, catégorie).
- **Upload client réel** : `POST /client/documents/upload` (binaire) — fin des
  `file_url` placeholder.
- **QR matériel réel** : génération `qrcode` côté client + téléchargement PNG réel.
- **Pointage RH réel** : scan badge (lecteur clavier) → `recordAttendance` réel
  (fini le « Emmanuel Nganou » codé en dur).

### Données codées en dur supprimées (détectées en multi-lignes)
- `ClientDocuments` : carte « Avenant budgétaire #1 / +10 000 000 FCFA /
  Avenant_01_Fondations.pdf » supprimée (flux de signature réel déjà présent).
- `ErpChantiers` : tableau « Suivi Budgétaire » (45/35/10 M…) → budget réel
  (`budget`/`spent`) ; galerie photos + compteur → `useProjectGallery` réel.
- `ClientDashboard` : alerte appel de fonds (montant + échéance) → facture réelle.
- `ClientSAV` : date de livraison → `estimated_end_date` réel.
- `ClientMessages` : prochaine visite → rendez-vous réel (timeline) ; simulation
  Zoom factice supprimée.
- `ErpJournalActivite` : IP `Math.random()` + User-Agent codé → champs réels
  (`ip_address`/`user_agent`, exposés par l'API), masqués si absents.
- **Images placeholder Unsplash** : toutes supprimées (6 fichiers) → données
  médias réelles ou fallback neutre.
- Dates/valeurs par défaut codées (`2026-03`, « Admin Globus », filtres de phases
  codés) → dynamiques / vides.

### Validation finale
`npx tsc --noEmit` = 0 · `vite build` OK · `vitest run` = 42/42 ·
`pytest` = 176/176 (dont `test_phase19.py` couvrant garanties, situations
sous-traitants, réglages RC/NIU, choix matériaux, upload GED/client, suppression).
Audit multi-lignes final : 0 (montants, noms, images externes, handlers factices).
