---
id: erp-tableau-de-bord
title: Tableau de bord
space: erp
section: Prise en main
order: 20
route: /erp
perms: [dashboard:view]
summary: La synthèse du jour - chantiers, retards, sécurité, SAV et, selon vos droits, finances, approbations en attente, commercial et trafic du site.
keywords: [accueil, synthèse, indicateurs, KPI, approbations]
related: [erp-rapports, erp-rapport-direction]
---

## À quoi sert cet écran

Le tableau de bord (**Tableau de bord** dans le menu) rassemble les indicateurs clés, recalculés à chaque ouverture (« Synthèse mise à jour le … »). Chaque bloc n'apparaît que si votre profil a accès aux données correspondantes.

## Indicateurs communs

- **Chantiers actifs** (et avancement moyen), **Jalons en retard**, **Incidents QHSE graves ouverts**, **Tickets SAV ouverts** (avec le nombre hors délai).
- **Santé des chantiers actifs** : répartition dans les temps / à risque / critique.

::: perm dashboard:direction, finance:read
## Finances

- **CA signé**, **Facturé** (et encaissé ce mois), **Créances à encaisser** (dont en retard), **Dettes fournisseurs à payer**.
- **Trésorerie prévisionnelle (6 mois)** : encaissements attendus, décaissements et solde cumulé.
- **Marge et coûts** puis **Marges par chantier**, classées de la plus faible à la plus forte : repérez les chantiers à surveiller.
- Bouton **Finances** pour ouvrir le détail ([Finances](doc:erp-finances)).
:::

## Approbations en attente

Le bloc **Approbations en attente** liste ce qui attend une décision : demandes d'achat à approuver, paiements à approuver, situations à valider, décisions client en attente, demandes d'achat soumises. Chaque ligne ouvre directement l'écran concerné.

::: perm deliveries:read, deliveries:receive
## Livraisons attendues (7 jours)

Livraisons prévues sur les chantiers dans la semaine, en rouge si elles sont en retard. Le bouton **Livraisons** ouvre le suivi ([Livraisons](doc:erp-livraisons)).
:::

::: perm billing:read, disputes:read
## Contrôles

Factures fournisseurs en anomalie (rapprochement 3 pièces) et litiges ouverts : boutons **Factures en anomalie** et **Litiges ouverts**.
:::

::: perm suppliers:read, subcontracting:read
## Performance partenaires

Classement des fournisseurs et sous-traitants par qualité et ponctualité.
:::

::: perm crm:read
## Commercial

**Entonnoir commercial** (leads → opportunités → devis → contrats) et **Leads par source**. Le bouton **CRM** ouvre le [CRM](doc:erp-crm).
:::

::: perm support:read
## Satisfaction client

Note moyenne de satisfaction SAV et respect des délais de réponse sur 90 jours.
:::

::: perm analytics:read
## Site web

**Trafic de la vitrine (30 jours)** (sessions, conversions, taux) et **Campagnes (ROI)** par campagne UTM. Le bouton **Analytics** ouvre le détail ([Analytics](doc:erp-analytics)).
:::
