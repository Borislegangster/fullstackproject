---
id: erp-hub-bim
title: Hub BIM
space: erp
section: Projets
order: 30
route: /erp/hub
routes: [/erp/hub/issues, /erp/hub/issues/*, /erp/bim, /erp/bim/*]
perms: [bim:read]
summary: Maquette fédérée multi-disciplines, versions de maquettes, issues localisées, détection de conflits, zones QR et calques de disciplines - en temps réel.
keywords: [BIM, IFC, maquette, revit, issue, conflit, clash, zone, QR, discipline, coordination, réunion]
related: [erp-chantiers, erp-ged, erp-configurateur]
---

## Accès

Menu **Projets › Hub BIM** (ou **Hub BIM du projet** depuis la fiche projet). Choisissez le projet ; six onglets : **Maquette fédérée**, **Maquettes**, **Issues**, **Conflits**, **Zones**, **Disciplines**. Les collaborateurs connectés au même projet voient en direct les curseurs et les modifications.

## Onglet « Maquette fédérée »

Toutes les disciplines superposées. Outils : rotation, zoom, coupe, masquage par discipline, plein écran.

- Mode **Naviguer** (par défaut) ou **Placer une issue** : cliquez l'endroit concerné dans la maquette.
- Blocs **Issues ouvertes**, **Points de vue** (vues enregistrées : nommez la vue puis l'icône appareil photo ; cochez **Vue présentée au client (espace client)** pour la proposer au client, badge **Client**) et **Versions** des maquettes chargées.
- **Voir dans la maquette** recentre la vue sur une issue.

::: perm bim:write
### Créer une issue depuis la maquette

1. Passez en mode **Placer une issue** et cliquez l'élément concerné.
2. Dans **Nouvelle issue BIM** : titre, type (question, observation, défaut, conflit), priorité, discipline, responsable, échéance ; une capture de la vue est jointe automatiquement.
3. **Créer l'issue** : elle est localisée dans la maquette et notifiée au responsable.
:::

## Onglet « Maquettes »

Une maquette par discipline, avec des versions successives : les fichiers IFC sont lus directement dans le navigateur, les fichiers RVT / DWG / NWD sont convertis par Autodesk APS.

::: perm bim:write
1. **Nouvelle maquette** : nom et discipline (obligatoires), description.
2. **Nouvelle version** ouvre **Nouvelle version de la maquette** : déposez le fichier puis **Déposer**. Suivez la conversion (statut « prête »). En cas d'échec de conversion APS, **Relancer**.
:::

::: perm bim:validate
3. **Valider** une version prête (contrôle qualité effectué).
4. **Publier** ouvre **Publier la version** : elle devient la version de référence.
:::

::: perm projects:publish_client
Lors de la publication, cochez **Rendre visible dans l'espace client (immersion 3D)** pour que le client puisse l'explorer.
:::

## Onglet « Issues »

La liste des **Issues BIM** (questions, observations, défauts et conflits localisés, avec circuit de résolution) se filtre par **Statut** et **Discipline**. Ouvrez une issue pour voir sa localisation, ses captures et ses **Échanges**.

::: perm bim:write
- **Nouvelle issue** depuis la liste (sans localisation) ; **Modifier** ouvre **Modifier l'issue**.
- **Faire évoluer** ouvre **Faire évoluer l'issue** : **Prendre en charge**, **Déclarer résolue**, **Rouvrir**, **Remettre en attente** (la clôture est réservée à la coordination).
- Ajoutez un message dans **Échanges** puis **Envoyer** (photos possibles).
:::

::: perm bim:coordinate
- **Clôturer** une issue résolue après vérification.
:::

::: perm calls:use
- **Réunion** ouvre **Réunion de coordination** : invitez les participants puis **Lancer l'appel** (visio avec la maquette partagée).
:::

## Onglet « Conflits »

Liste des **Conflits** (clashes) détectés entre disciplines, avec leur statut ; graphiques **Par paire de disciplines** et **Par statut**.

::: perm bim:coordinate
### Détection assistée

Les boîtes englobantes des éléments sont calculées dans votre navigateur puis comparées selon la règle (tolérance, type) : choisissez les versions et la règle puis **Lancer la détection**.

### Règles de détection

**Nouvelle règle** : nom, **Discipline A** et **Discipline B** (obligatoires), type de conflit, tolérance (mm), gravité, coût estimé par conflit. Modifiez ou supprimez une règle depuis sa fiche.

### Traiter un conflit

Ouvrez un conflit puis **Créer une issue** (responsable et échéance) : le conflit devient une issue suivie jusqu'à résolution.
:::

## Onglet « Zones »

Les **Zones spatiales** (pièces, niveaux, zones extérieures) portent un QR à afficher sur site : le scan ouvre le contexte BIM de la pièce (éléments, issues, liste de contrôle).

::: perm bim:write
- **Nouvelle zone** : code et nom (obligatoires), chantier, niveau, type (pièce, zone, niveau, extérieur), discipline, surface, **Libellé client**, contrôles de réception (bouton **Contrôle de réception**).
:::

- **QR de la zone** affiche le QR ; **Imprimer** pour l'afficher sur site.

## Onglet « Disciplines »

**Calques de disciplines** : couleur et visibilité par discipline dans la maquette fédérée. Ces disciplines alimentent aussi les cases **Disciplines** des membres du projet.

::: perm bim:coordinate
- **Ajouter une discipline au projet** : nom, couleur, ordre d'affichage, **Visible par défaut**, puis **Enregistrer**. L'identifiant interne du calque est créé à partir du nom : rien à saisir. Un nom déjà utilisé est refusé (modifiez la discipline existante).
- **Modifier** sur une ligne charge la discipline dans le formulaire (nom, couleur, ordre, visibilité) ; **Nouvelle discipline** revient à l'ajout.
:::
