# Propositions d'innovation — GLOBUS ENGINEERING

Objectif : rendre l'entreprise **plus autonome** (moins de tâches manuelles, décisions éclairées), la plateforme
**plus innovante** et surtout **plus rassurante** pour les clients — en particulier la diaspora qui construit à
distance. Chaque proposition s'appuie sur des briques déjà en place (CMS, CRM, achats, sous-traitance, BIM,
configurateur 3D, paiements MTN MoMo / Orange Money, notifications multicanal, IA Claude, assistant de la vitrine).

Effort : S (≤ 2 semaines) · M (≤ 6 semaines) · L (> 6 semaines).

## 1. Rassurer — « voir, comprendre, décider »

| # | Fonctionnalité | Ce que ça change | Briques réutilisées | Effort |
|---|---|---|---|---|
| R1 | **Paiement par jalon sous séquestre** : l'appel de fonds Mobile Money est bloqué chez un partenaire (banque / établissement de paiement) et libéré seulement à la validation du jalon (PV + photos datées + OTP client) | Argument décisif pour la diaspora : « vous ne payez que ce qui est construit » | appels de fonds, décisions OTP, preuves photo, MoMo / Orange | L (partenaire agréé requis) |
| R2 | **Journal de chantier vidéo automatique** : time-lapse hebdomadaire généré depuis les photos géolocalisées + caméra 4G, envoyé le lundi par WhatsApp | Le client « voit » son chantier avancer sans se connecter | médias projet, notifications WhatsApp, workers | M |
| R3 | **Indice de confiance du chantier** visible par le client (0-100) : respect du planning, du budget, contrôles qualité passés, réactivité SAV | Transforme des données techniques en un signal simple et rassurant | `compute_health`, QHSE, planning, SAV | S |
| R4 | **Preuves opposables** : horodatage certifié (OpenTimestamps déjà branché) étendu aux PV, photos de réception et décisions ; page publique de vérification par QR code | Chaque document remis est vérifiable par un tiers (banque, notaire, assureur) | GED, `/verification/{token}`, audit | S |
| R5 | **Visite immersive 360° / VR** de la maquette avant construction, partageable à la famille par lien sécurisé | Projection émotionnelle forte, moins de changements tardifs | configurateur 3D, BIM, liens signés | M |
| R6 | **Avis clients vérifiés** collectés automatiquement à la remise des clés (note + vidéo consentie) et publiés sur la vitrine | Preuve sociale authentique (V4 : PREUVE) | SAV satisfaction, témoignages CMS, consentements | S |

## 2. Autonomie — l'entreprise qui tourne toute seule

| # | Fonctionnalité | Ce que ça change | Briques réutilisées | Effort |
|---|---|---|---|---|
| A1 | **Assistant WhatsApp bidirectionnel** (même moteur que le chatbot de la vitrine) : questions des prospects, suivi de chantier, envoi d'un reçu, prise de rendez-vous | Le canal n°1 au Cameroun devient un guichet 24 h / 24 | module `assistant`, WhatsApp Business, CRM, agenda | M |
| A2 | **Devis budgétaire instantané par IA** à partir d'une photo du terrain, d'un croquis ou d'une note vocale (Claude vision + barèmes internes), validé ensuite par un ingénieur | Qualification et chiffrage des leads en minutes au lieu de jours | estimateur « Décrire mon projet », IA, CRM | M |
| A3 | **Achats prédictifs** : indice local des prix (ciment, acier, sable) alimenté par les réponses fournisseurs de l'extranet, alertes de hausse et recommandations d'achat anticipé | Protège la marge et les budgets clients | consultations fournisseurs, 3-way match, budgets | M |
| A4 | **Planning intelligent** : alerte proactive des retards (saison des pluies, délais fournisseurs, absences) avec proposition de replanification | Moins de surprises, communication client anticipée | planning, approvisionnements, RH, météo (API) | M |
| A5 | **Détection d'anomalies** sur achats et factures (prix hors marché, doublons, fractionnement de commandes) | Contrôle interne automatique, lutte contre la fraude | billing, procurement, audit | S |
| A6 | **Recouvrement automatique** : relances graduées déjà en place + lien de paiement Mobile Money en un clic + plan d'échelonnement proposé par l'assistant | Trésorerie plus régulière sans relance manuelle | module `billing` (relances), paiements | S |
| A7 | **Rapport de direction hebdomadaire rédigé par l'IA** (marge, trésorerie prévisionnelle, risques, chantiers à surveiller) envoyé chaque lundi | La direction pilote sans compiler de tableaux | rapports, IA, notifications | S |

## 3. Innover — se démarquer durablement

| # | Fonctionnalité | Ce que ça change | Briques réutilisées | Effort |
|---|---|---|---|---|
| I1 | **Jumeau numérique de chantier** : comparaison automatique photos / drone ↔ maquette BIM pour mesurer l'avancement réel | Avancement objectif, facturation à l'avancement incontestable | BIM, médias, IA vision | L |
| I2 | **Passeport du bâtiment** remis à la livraison : plans conformes, garanties, notices, carnet d'entretien et rappels de maintenance (SAV prédictif) | Relation client à vie, revenus de maintenance | passeport (espace client), GED, SAV | M |
| I3 | **Offre « énergie & confort »** : simulation solaire / isolation intégrée au configurateur avec impact sur la facture d'électricité | Argument premium et écologique, ventes additionnelles | configurateur 3D (matériaux, deltas prix) | M |
| I4 | **Panneau de chantier connecté** : QR code menant à une page publique du projet (permis, entreprise, contacts, recrutement local) | Transparence envers les riverains, image de marque, génération de leads | CMS, réalisations, vitrine | S |
| I5 | **Financement intégré** : simulateur de crédit et dossiers transmis aux banques partenaires, paiement échelonné Mobile Money | Lève le principal frein à la signature | CRM, paiements, documents | L (partenariats) |
| I6 | **Programme ambassadeurs diaspora** : parrainage suivi dans le CRM, récompense à la signature | Acquisition à faible coût dans les communautés | CRM, newsletter, vitrine | S |

## 4. Feuille de route proposée

| Horizon | Lot | Contenu |
|---|---|---|
| 0 – 3 mois (gains rapides) | Confiance visible | R3 indice de confiance, R4 preuves opposables étendues, R6 avis vérifiés, A5 anomalies, A6 recouvrement, A7 rapport IA, I4 panneau connecté, I6 ambassadeurs |
| 3 – 6 mois | Canal WhatsApp & IA | A1 assistant WhatsApp, A2 devis instantané, R2 time-lapse, A3 achats prédictifs, A4 planning intelligent, R5 visite 360° |
| 6 – 12 mois | Différenciation | R1 séquestre par jalon, I1 jumeau numérique, I2 passeport + maintenance, I3 énergie & confort, I5 financement |

Pré-requis communs : hébergement HTTPS en production, comptes WhatsApp Business et opérateurs Mobile Money,
clé IA dans le coffre de secrets, contenus réels (photos, vidéos, témoignages consentis).

## 5. État de réalisation (13/10/2026)

Proposition validée intégralement ; les 19 innovations sont développées dans `systemcomplet/` (API + web) et démontrées
par des tests automatisés : `backend/tests/test_innovations_lot1.py`, `test_innovations_lot2.py`,
`test_innovations_lot3.py` (migrations `0007` → `0009`). Les montants et ratios affichés au public (énergie,
financement) sont paramétrables (`Setting`) et présentés comme indicatifs.

| # | Module API | Écrans | Activation en production |
|---|---|---|---|
| R1 | `escrow` (compte, rattachement appel ↔ jalon, preuves, OTP client, double validation, médiation) | Espace client › Finances ; ERP › chantier › Séquestre ; ERP › Finances › Séquestre par jalon | Convention avec une banque ou un notaire : le compte reste « convention en attente » tant que la Direction ne l'active pas (aucune libération automatique) |
| R2 | `timelapse` (vidéo hebdomadaire ffmpeg, envoi WhatsApp du lundi) | Espace client › Chantier ; ERP › chantier › Photos et vidéos | Modèle WhatsApp `globus_timelapse_hebdo` approuvé ; caméras 4G optionnelles |
| R3 | `projects/trust` (indice 0-100, alerte au franchissement) | Tableau de bord client ; ERP › chantier › Confiance et preuves | — |
| R4 | `proofs` (empreintes, arbre de Merkle, OpenTimestamps, QR) | `/verification/{code}` ; Espace client › Preuves certifiées | Accès Internet sortant pour l'ancrage public |
| R5 | `visits` (visite 360° / VR, liens familiaux signés) | Espace client › Immersion ; `/visite/{token}` | — |
| R6 | `reviews` (invitation à la remise des clés, avis vérifiés, vidéo consentie) | `/avis/{token}` ; Espace client › Mon avis ; ERP › chantier › Avis client | Fournisseur e-mail / WhatsApp |
| A1 | `assistant` (WhatsApp bidirectionnel, même moteur que la vitrine) | ERP › Assistant et WhatsApp | Compte WhatsApp Business (Meta) et webhook HTTPS |
| A2 | `crm/instant` (photo, croquis ou note → fourchette IA, validation ingénieur) | `/estimation-instantanee` ; ERP › CRM | Clé IA (coffre de secrets) |
| A3 | `market` (indice local des prix, alertes, achats anticipés) | ERP › Prix des matériaux | Réponses fournisseurs de l'extranet |
| A4 | `scheduling` (risques de retard, météo, proposition de replanification) | ERP › chantier › Planning | Fournisseur météo (`WEATHER_PROVIDER=open-meteo`) |
| A5 | `ai/controls` (fractionnement, quasi-doublons, RIB modifié, double paiement…) | ERP › Rapports › Anomalies (`/erp/rapports/anomalies`) | — |
| A6 | `finance/payments` + échéanciers (OTP client, liens de paiement par échéance) | Espace client › Finances ; ERP › Échéanciers clients | Contrats marchands MTN MoMo / Orange Money |
| A7 | `reports/executive` (rapport hebdomadaire, synthèse rédigée par l'IA) | ERP › Rapport de direction | Clé IA pour la rédaction (chiffres disponibles sans IA) |
| I1 | `twin` (photos ↔ planning ↔ maquette, validation, certification) | ERP › chantier › Jumeau numérique ; Espace client › Chantier | Clé IA (aucune estimation fabriquée sans IA) |
| I2 | `maintenance` (équipements, notices, carnet, rappels J-14 / veille, SAV prédictif, passeport certifié) | Espace client › Mon bâtiment ; ERP › chantier › Bâtiment et maintenance | — |
| I3 | `energy` (isolation, protections solaires, inverter, LED, solaire, batterie ; tarifs par tranches) | `/energie-confort` ; Espace client › Énergie et confort ; ERP › chantier › Énergie | Validation des ratios par un ingénieur GLOBUS |
| I4 | `panels` (page publique du chantier, QR, candidatures, demandes de devis) | `/chantiers/{slug}` ; ERP › chantier › Panneau connecté | — |
| I5 | `financing` (simulateur, dossier unique, consentement, portail partenaire filigrané, offre acceptée par OTP) | `/financement` ; `/financement/partenaire/{token}` ; Espace client › Financement ; ERP › Financement clients | Conventions avec les établissements (contacts d'instruction) |
| I6 | `referrals` (codes ambassadeurs, prime à la signature, contrôle des RIB) | `/parrainage/{code}` ; Espace client › Parrainage ; ERP › Ambassadeurs | — |

