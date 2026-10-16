# Revue de code et recette — Master Cahier des charges V4

Date : 13/10/2026 · Périmètre : `systemcomplet/` (API FastAPI + PostgreSQL, web Next.js : vitrine, espace client, ERP, extranet).
Principe de la PARTIE XXXI : « la fonctionnalité n'existe que lorsqu'elle est démontrée » — chaque critère renvoie à un
test automatisé ou à un contrôle de build.

## 1. Synthèse

| Contrôle | Résultat |
|---|---|
| Tests backend (`pytest`, PostgreSQL réel, rollback par test) | **100 % verts** |
| Lint backend (`ruff check` + `ruff format --check`) | OK |
| Migrations Alembic ↔ modèles (`scripts/check_migrations.py`) | synchronisées (0001 → 0009) |
| Web : `tsc --noEmit`, `next lint --max-warnings=0` | OK |
| Web : `check:mocks` (V4-DEPLOY-42), `check:links` (389 liens / 188 routes) | OK |
| Web : `next build` (production) | OK |

Verdict : les 42 critères d'acceptation sont couverts par le code et démontrés par des tests ou contrôles de build.
Les points qui dépendent d'éléments externes (clés opérateurs, hébergement, comptes fournisseurs de messagerie) sont
listés au §4 : ils ne bloquent pas la recette fonctionnelle mais conditionnent la mise en production.

## 2. Matrice de recette (PARTIE XXXI)

| ID | Critère | Preuve |
|---|---|---|
| V4-SEC-01 | HTTPS/WSS en production | `core/config.py` refuse `PUBLIC_BASE_URL`/`API_PUBLIC_URL` non HTTPS en prod, WebSocket dérivé en `wss://` ; HSTS (API + nginx) ; CSP web `upgrade-insecure-requests` — `tests/test_production_guards.py` |
| V4-SEC-02 | Secrets jamais affichés | coffre `core/secrets.py` (valeurs masquées), RIB / Mobile Money masqués — `test_platform`, `test_procurement_flow` |
| V4-SEC-03 | MFA imposable | `mfa_required` (rôles privilégiés, **clients invités**), blocage `MFA_ENROLLMENT_REQUIRED` — `test_mfa_totp_flow`, `test_invitation_activation_imposes_mfa_for_clients` |
| V4-SEC-04 | Actions sensibles auditées avec correlation_id | `core/audit.py` (chaîne de hachage, append-only) — `test_login_me_and_correlation_id`, `test_audit_chain_and_append_only` |
| V4-CMS-05 | Aucune donnée métier mockée en prod | `check-no-mocks.mjs` (web + API), simulateurs refusés en prod — `test_production_rejects_simulators` |
| V4-CMS-06 | CMS vide → état vide explicite | `EmptyPublicState` (vitrine) — `test_empty_cms_returns_explicit_empty_state` |
| V4-MEDIA-07 | Médias vitrine issus de la médiathèque (`media_id`) | validation des références (blocs, sections, réglages), **logo versé dans la médiathèque** — `test_media_library_is_mandatory`, `test_block_visuals_must_come_from_media_library` |
| V4-SEO-08 | Metadata + canonical par route indexable | `lib/seo.tsx` `buildMetadata` (toutes les routes publiques) — `test_publication_workflow_and_seo` |
| V4-SEO-09 | sitemap/robots = contenus publiés | `/sitemap.xml`, `/robots.txt` alimentés par l'API — idem |
| V4-SUP-10 | PO envoyé au fournisseur par provider traçable | WhatsApp/e-mail tracés — `test_po_whatsapp_reception_three_way_match_payment` |
| V4-SUP-11 | Alerte de livraison au chef de chantier | notification `delivery.*` — idem |
| V4-SUP-12 | Réception : quantités + preuves | GRN photos/géolocalisation — idem |
| V4-SUP-13 | 3-way match PO/GRN/facture | module `billing` — idem, `test_procurement_exceptions` |
| V4-SUB-14 | Devis, situation, facture sous-traitant | extranet — `test_subcontracting_quote_contract_situation_invoice_payment_dispute` |
| V4-SUB-15 | Situation au-delà du contrat bloquée sans dérogation | idem |
| V4-SUB-16 | Litiges : statut, preuves, chronologie | idem |
| V4-CALL-17/18/19 | Appels audio, vidéo, partage d'écran | WebRTC + signalisation WS + TURN — `test_calls_screen_share_and_recording_consent` |
| V4-BIM-20…23 | Multi-disciplines, annotations versionnées, issues, temps réel | `test_bim_hub_versions_annotations_issues_clashes` |
| V4-3D-24…27 | Maquette mobile, matériaux, delta prix/délai, validation horodatée | `test_configurator_scenario_to_locked_decision` |
| V4-GED-28…30 | Versions, obsolescence, documents protégés et audités | `test_document_lifecycle` (versions, obsolescence, journal d'accès, ACL) ; filigrane nominatif des PDF (`documents/router.py`) |
| V4-DATA-31…33 | Identifiants communs, pas d'écrasement offline, idempotence | `test_offline_sync_conflicts_and_idempotence` + clés `Idempotency-Key` (paiements, décisions) |
| V4-AUDIT-34 | Familles business / security / system | `test_audit_chain_and_append_only` |
| V4-ANALYTICS-35/36 | Segmentation par période, statistiques blog complètes | `test_analytics_segmented_by_period_and_blog_stats`, `test_blog_interactions_and_moderation` |
| V4-MAIL-37 | Désabonnés exclus | `test_newsletter_excludes_unsubscribed` |
| V4-CRM-38 | Formulaire de contact → lead | `test_contact_form_creates_lead_with_consent_and_autoreply` ; **assistant → lead « chatbot »** `test_lead_capture_requires_consent` |
| V4-NOTIF-39 | In-app / push / e-mail / WhatsApp selon règle | `test_notification_center_and_preferences`, `test_messaging_rules_and_realtime` |
| V4-BACKUP-40/41 | Restauration contrôlée, break-glass + MFA + justification | `test_admin_security_backup_audit_reports` |
| V4-DEPLOY-42 | Build de prod en échec si mocks interdits | `apps/web/scripts/check-no-mocks.mjs` exécuté par **`npm run build` (prebuild)**, par `web.Dockerfile` et par la CI (web + API) ; seeder et illustrations de démo retirés de l'image API |

## 3. Anomalies trouvées et corrigées pendant cette revue

| # | Constat | Correction | Preuve |
|---|---|---|---|
| 1 | Un visiteur pouvait créer lui-même un compte client (`/inscription`) | Accès client **sur invitation uniquement** (admin, ou automatiquement à la signature du contrat) ; identifiants envoyés par e-mail et/ou WhatsApp ; changement de mot de passe + MFA obligatoires à l'activation | `test_no_public_self_registration`, `test_admin_invites_client_by_email_and_whatsapp`, `test_signed_contract_opens_client_access_automatically`, `test_invitation_activation_imposes_mfa_for_clients` |
| 2 | Pas d'assistant conversationnel sur la vitrine | Module `assistant` (réponses sourcées dans le CMS, mode Claude si clé configurée, garde-fous : pas de prix, liens internes uniquement), widget flottant (chat, WhatsApp, appel, retour en haut), prise de rappel avec consentement → lead CRM | `tests/test_assistant.py` |
| 3 | L'image de fond d'une section CMS (`settings.media_id`) n'était jamais renvoyée par l'API publique | Résolution des médias de section dans `page_public_payload` | `test_section_background_and_block_visuals_are_resolved` |
| 4 | Identifiants de balises (GA4, Meta, TikTok, LinkedIn) acceptés sans contrôle côté API | Validation stricte (`INVALID_TRACKING`) en plus du filtrage côté navigateur | `test_tracking_identifiers_are_strict` |
| 5 | Application web sans Content-Security-Policy | CSP de production (origines réellement utilisées ; politique dédiée aux visionneuses 3D/BIM) dans `next.config.ts` | build de production |
| 6 | Animations d'apparition : contenu masqué tant que le JavaScript n'avait pas tourné (risque SEO / accessibilité) | Contenu visible par défaut ; seuls les éléments hors écran sont masqués après hydratation | revue visuelle (Chrome headless) |
| 7 | Logo de la vitrine servi hors médiathèque | Logo officiel versé dans la médiathèque par le contenu éditorial (variante WebP légère dans l'en-tête) | `test_editorial_content_is_idempotent_and_contains_no_invented_data` |
| 8 | Aperçu des fichiers limité aux PDF/images de la GED | Visionneuse universelle (PDF, images avec zoom, vidéo, audio, Excel xlsx/xls/ods/csv avec onglets et filtre, Word/ODT, PowerPoint/ODP, texte) dans l'ERP, l'extranet et l'espace client ; conversion sans stockage, ZIP contrôlés, HTML assaini | `tests/test_file_preview.py` |
| 9 | Catégories de services / disciplines affichées en codes bruts (`ingenierie`) | Libellés (`Ingénierie`…) | revue visuelle |
| 10 | Tri des imports : le dossier `alembic/` masquait le paquet tiers pour isort | `known-third-party = ["alembic"]` | `ruff check` |
| 11 | V4-DEPLOY-42 : l'image web annonçait le contrôle anti-mock sans l'exécuter ; un `npm run build` manuel ne le lançait pas | contrôle ajouté au `prebuild` et au `web.Dockerfile` ; illustrations de démo exclues de l'image API | `npm run build` |

## 4. Points d'attention avant la mise en production

1. **Hébergement et nom de domaine** : à choisir (VPS / cloud, DNS, certificats). Aucun déploiement n'a été lancé.
2. **Clés opérateurs** : MTN MoMo (collection + disbursement, environnement `mtncameroon`) et Orange Money WebPay
   (`cm`) — contrats marchands à signer ; les flux sont testés contre une reproduction fidèle des API.
3. **Messagerie** : fournisseur e-mail (SMTP / Mailgun) et WhatsApp Business (BSP) pour les invitations et les
   notifications ; sans eux, la plateforme refuse d'envoyer (aucun faux envoi en production).
4. **Appels** : serveur TURN public (coturn) avec TLS ; le partage d'écran exige HTTPS (V4-CALL-19).
5. **Contenus réels** : photos et vidéos de chantiers, coordonnées (téléphone, WhatsApp — ils activent les boutons
   d'appel et WhatsApp du widget), témoignages consentis, chiffres clés sourcés. Les illustrations générées ne servent
   qu'au jeu de démonstration.
6. **IA** : le mode « Claude » de l'assistant et des assistants métier s'active en renseignant la clé dans le coffre de
   secrets ; sans clé, le moteur de règles répond à partir des contenus publiés.
7. **Durcissement recommandé** : CSP à nonces (suppression de `'unsafe-inline'` pour les scripts), test d'intrusion
   externe, audit d'accessibilité (RGAA), tests de charge, sauvegardes hors site chiffrées, supervision (alertes).
8. **Phase 2** : applications desktop (Tauri) et mobile — non commencées, conformément au plan validé.
9. **Innovations** (`docs/INNOVATIONS.md` §5, 19 fonctionnalités livrées et testées) : activation conditionnée par
   des partenaires externes — convention de séquestre (R1, banque ou notaire), conventions avec les établissements de
   crédit (I5), modèle WhatsApp `globus_timelapse_hebdo` approuvé (R2), clé IA (A2, A7, I1), fournisseur météo (A4) ;
   ratios énergie (I3) à valider par un ingénieur.

## 5. Reproduire la recette

```bash
cd backend && .venv/Scripts/python -m pytest
cd backend && .venv/Scripts/ruff check . && .venv/Scripts/ruff format --check .
cd backend && .venv/Scripts/python scripts/check_migrations.py
cd apps/web && npm run verify
```
