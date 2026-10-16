---
id: erp-financements
title: Financement des clients
space: erp
section: Finance
order: 50
route: /erp/finances/financements
perms: [finance:read]
summary: Établissements de crédit partenaires (critères du simulateur public) et dossiers de financement transmis par les clients avec leur accord.
keywords: [financement, crédit, banque, microfinance, diaspora, dossier, offre, simulateur, activer, ouvrir, fermer, module client]
related: [erp-finances, erp-crm]
---

## Ouvrir le financement aux clients

Le module **Financement** de l'espace client est **fermé par défaut** : la carte en haut de l'écran indique « Visible des clients » ou « Masqué des clients » et le taux de référence du simulateur. Fermé, le menu **Financement** n'apparaît pas chez les clients et aucun dossier ne peut être créé ; le simulateur public du site reste accessible.

::: perm settings:write
- **Ouvrir aux clients** ouvre la fenêtre « Ouvrir « Financement » aux clients » : confirmez avec **Ouvrir** ; le menu apparaît chez tous les clients.
- **Fermer aux clients** (confirmation **Fermer**) le masque à nouveau ; les dossiers déjà engagés restent consultables par leurs titulaires.
- Chaque changement est inscrit au [journal d'audit](doc:erp-audit).
:::

## Établissements partenaires

Menu **Finance › Financement clients** (écran **Financement des clients**). Les taux, durée maximale, apport minimal et taux d'endettement maximal de chaque établissement alimentent l'éligibilité indicative du simulateur public et de l'espace client.

::: perm finance:write
- **Nouveau partenaire** : nom, type (banque, microfinance, offre diaspora), description, taux minimum et maximum, durée maximale, apport minimal (%), endettement maximal (%), frais (%), pièces exigées, contact d'instruction (nom, e-mail — requis pour pouvoir transmettre des dossiers), actif, ordre d'affichage.
- Le crayon modifie un partenaire ; décochez **Actif** pour le retirer du simulateur.
:::

## Dossiers des clients

Les clients constituent leur dossier dans leur espace (montant, apport, durée, revenus, pièces) et le transmettent, avec leur consentement explicite, aux établissements choisis. Onglets **Tous**, **Transmis**, **Offre reçue**, **Acceptés**, **Brouillons**, **Retirés**.

Pour chaque dossier : montant, apport, durée, nombre de pièces, date de transmission, lien vers le **projet**, et pour chaque établissement : consulté ou non, statut (envoyé, consulté, à l'étude, offre, refus) et offre reçue (montant, taux, durée, mensualité).

Les établissements consultent le dossier par un lien nominatif valable 30 jours (pièces filigranées à leur nom) et répondent en ligne. Un client peut retirer son accord à tout moment : les liens sont aussitôt révoqués. Quand le client accepte une offre (par code), la ligne indique l'établissement et la date : accompagnez la signature du prêt et calez les appels de fonds sur les déblocages.
