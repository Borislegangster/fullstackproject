---
id: erp-qhse
title: QHSE - sécurité, qualité, environnement
space: erp
section: RH et QHSE
order: 20
route: /erp/qhse
routes: [/erp/qhse/incidents, /erp/qhse/incidents/*, /erp/qhse/actions, /erp/qhse/actions/*]
perms: [qhse:read]
summary: Incidents déclarés sur le terrain, analyse des causes et actions correctives vérifiées, inspections sur grilles pondérées, distributions d'EPI et quarts d'heure sécurité.
keywords: [QHSE, sécurité, incident, accident, presque-accident, inspection, grille, action corrective, EPI, quart d'heure, causerie, non-conformité]
related: [erp-rh, erp-chantiers]
---

## Accès

Menu **RH et QHSE › QHSE**. Onglets **Indicateurs**, **Incidents**, **Inspections**, **Actions correctives**, **EPI**, **Quarts d'heure**, **Grilles**.

## Onglet « Indicateurs »

**Incidents par mois** (avec les heures travaillées de la période, base des taux de fréquence et de gravité) et **Par nature** (accident, presque-accident, qualité, environnement…).

## Onglet « Incidents »

Les **Incidents** : déclaration terrain (photos géolocalisées) → enquête → plan d'actions → clôture vérifiée. Filtres **Statut**, **Gravité**, **Nature** ; **Exporter** selon vos droits.

::: perm qhse:write, site:report
### Déclarer un incident

**Déclarer un incident** ouvre **Déclaration d'incident** : nature, gravité, date et heure, projet et chantier, **Zone de la maquette** (facultatif), lieu (**Utiliser ma position**), description, personnes concernées, premiers secours, photos ; **Déclarer l'incident**. Un incident grave est signalé immédiatement à l'encadrement et à la direction.
:::

### Suivre un incident

La fiche (**… — …**) présente l'**Analyse des causes** et le **Plan d'actions correctives** (chaque action est réalisée avec preuve, puis vérifiée par une autre personne).

::: perm qhse:write
- **Photos** ouvre **Ajouter des photos**.
- **Analyse des causes** ouvre **Analyse des causes** (méthode des 5 pourquoi, arbre des causes, facteurs).
- **Action corrective** ouvre **Nouvelle action corrective** : titre, responsable et échéance obligatoires.
- **Informer le client** ouvre **Informer le client** : message factuel publié dans son suivi de chantier (encadré « Communiqué au client »).
- **Clôturer** ouvre **Clôturer l'incident** une fois toutes les actions vérifiées.
:::

## Onglet « Inspections »

Les **Inspections** : grilles pondérées sécurité, qualité, environnement ; chaque non-conformité génère automatiquement une action. Filtres **Statut** et **Catégorie**.

::: perm qhse:write
1. **Nouvelle inspection** : **Projet** obligatoire ; grille (modèle), chantier, zone, catégorie, date.
2. Pour chaque **Point de contrôle** : conforme, non conforme (photo, commentaire) ou sans objet ; le score se calcule.
3. **Terminer l'inspection** ; puis **Clôturer l'inspection** (fenêtre **Clôturer l'inspection**) une fois les actions engagées.
:::

## Onglet « Actions correctives »

Les **Actions correctives** (filtre **Statut**), issues des incidents, inspections et audits.

::: perm qhse:write
- **Nouvelle action** : **Titre**, **Responsable** et **Date d'échéance** obligatoires ; projet, source.
:::

Sur une action (**… — …**), le responsable (ou le QHSE) :

1. **Démarrer** l'action.
2. **Déclarer réalisée** ouvre **Déclarer l'action réalisée** (description, preuve).
3. Une autre personne que le responsable **Vérifier** : la fenêtre **Vérification de l'efficacité** confirme ou rouvre l'action (**Valider la vérification**).
4. **Annuler** ouvre **Annuler l'action** (motif).

**Voir l'incident** revient à l'incident d'origine.

## Onglet « EPI »

- **Distributions d'EPI** : remise tracée (signature), date de renouvellement, retour.
- **Catalogue EPI** (filtre **Type**).

::: perm qhse:write
- **Remettre un EPI** : EPI obligatoire, employé (ou nom du travailleur), projet, quantité, date, signature, dépôt de sortie. **Retour** enregistre la restitution.
- **Nouvel EPI** : nom et type obligatoires, taille, article de stock, **Durée de vie (jours)** (calcul du renouvellement), norme.
:::

## Onglet « Quarts d'heure »

Les **Quarts d'heure sécurité** (causeries) : thème, animateur, participants (émargement), chantier.

::: perm qhse:write
- **Quart d'heure** ouvre **Quart d'heure sécurité** : thème, date, chantier, participants, points abordés.
:::

## Onglet « Grilles »

Les **Grilles d'inspection** servent de modèle aux inspections.

::: perm qhse:write
1. **Nouvelle grille** : **nom** obligatoire, catégorie (sécurité, qualité, environnement), **Actif**.
2. Ajoutez les points avec **Point de contrôle** : clé, libellé et poids (0 à 10) de chaque point ; la corbeille retire un point.
3. Enregistrez ; modifiez une grille depuis sa fiche.
:::
