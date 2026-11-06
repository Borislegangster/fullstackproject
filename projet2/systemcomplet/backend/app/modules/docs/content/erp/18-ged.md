---
id: erp-ged
title: GED - gestion électronique des documents
space: erp
section: Projets
order: 40
route: /erp/ged
routes: [/erp/ged/documents, /erp/ged/documents/*, /erp/documents]
perms: [documents:read]
summary: Documents versionnés, circuit d'approbation, publication « bon pour exécution », signature électronique par code, filigrane, droits spécifiques et journal des accès.
keywords: [document, GED, version, plan, approbation, publication, signature, filigrane, dossier, droits, confidentiel]
related: [erp-hub-bim, erp-ia, erp-chantiers]
---

## Accès

Menu **Projets › GED** (ou **Documents (GED)** depuis la fiche projet). Choisissez le projet (ou « Documents généraux ») : son arborescence de dossiers s'affiche à gauche avec le nombre de documents de chacun ; **Tous les documents** liste tout. La colonne **Emplacement** indique pour chaque document son projet et son dossier. Filtres **Type**, **Discipline**, **Statut**. Les documents confidentiels ou très sensibles ne sont visibles qu'avec l'habilitation correspondante.

::: perm documents:write
## Déposer un document

1. **Déposer un document** : projet, dossier, type (plan, note de calcul, contrat, PV…), discipline, code et titre, confidentialité, puis le fichier ; **Déposer**. Le titre et le **Mot-clé** sont pré-remplis avec le nom du fichier.
2. Le document est créé en brouillon (version 1).
3. **Nouveau dossier** (fenêtre du même nom) organise l'arborescence d'un projet : nom et **Confidentialité par défaut** (proposée à chaque dépôt dans ce dossier, reprise du dossier parent) ; **Créer**. Le nouveau dossier s'ouvre aussitôt dans l'arborescence.

Un même fichier (contenu identique, quel que soit son nom) ne peut être déposé qu'une fois par projet : un second dépôt est refusé et le message indique le document déjà présent et son dossier (s'il vous est accessible).

## Importer plusieurs fichiers ou un dossier

**Importer plusieurs fichiers ou un dossier** ouvre la fenêtre du même nom :

1. Glissez des fichiers ou un dossier entier dans la zone, ou utilisez **Choisir des fichiers** / **Choisir un dossier**. La corbeille retire un fichier de la liste.
2. Choisissez le **Projet**, le **Dossier de destination**, le **Type**, la **Discipline** et la **Confidentialité** appliqués à tous les fichiers. **Recréer les sous-dossiers** reproduit dans la GED l'arborescence du dossier importé.
3. **Importer** : chaque fichier devient un document en brouillon, avec pour titre et mot-clé le nom du fichier. Les fichiers déjà présents dans la GED du projet, ou en double dans la sélection, sont ignorés ; la liste indique pour chaque fichier « Déposé », « Déjà dans la GED — ignoré » ou l'erreur. **Terminer** ferme la fenêtre.
:::

## Actions groupées

Cochez des documents dans la liste (la case de l'en-tête coche toute la page) : une barre propose, selon vos droits, **Soumettre en revue**, **Valider** et **Publier** pour tous les documents cochés, et **Désélectionner**. Seuls les documents au bon statut sont traités ; un récapitulatif liste ceux qui ont été refusés et pourquoi.

## La fiche document

Cliquez un document : aperçu intégré (**Plein écran**), **Télécharger** (copie filigranée à votre nom, téléchargement tracé), et cinq onglets : **Versions**, **Approbations et signatures**, **Liens**, **Droits**, **Journal d'accès**.

- **Comparer** ouvre **Comparer deux versions** : choisissez deux versions pour voir leurs différences.

::: perm documents:write
- **Propriétés** ouvre **Propriétés du document** (titre, type, discipline, dossier, confidentialité). **Livrable d'études payant** : le client ne voit qu'un aperçu filigrané (PDF, images) jusqu'au règlement de la **Facture d'études qui débloque le livrable** ; l'original lui est alors remis (voir [Chantiers](doc:erp-chantiers), onglet **Études et livrables**).
- **Nouvelle version** ouvre **Nouvelle version** : déposez le fichier mis à jour ; la version précédente est conservée.
:::

::: perm documents:publish
- Dans les propriétés, les cases de visibilité **client** et **partenaires** publient le document dans l'espace client ou l'extranet (seule la version en vigueur est montrée).
:::

## Faire évoluer une version (circuit d'approbation)

Cycle : brouillon → en revue → (correction) → validé → publié → obsolète → archivé. **Faire évoluer** ouvre **Version … : faire évoluer** ; seules les étapes autorisées pour votre profil sont proposées :

::: perm documents:write
- **En revue** : définissez le circuit d'approbation, étape par étape (**Ajouter une étape** : un approbateur désigné ou un rôle). Chaque approbateur est notifié dans l'ordre.
:::

::: perm documents:approve
- **Valider** ou renvoyer en **correction** avec un commentaire. Double regard : l'auteur d'une version ne peut ni la valider ni publier directement son brouillon ; une autre personne le fait (seul le super administrateur peut valider seul, et c'est tracé).
:::

::: perm documents:publish
- **Publier** (« bon pour exécution ») : la version remplace la précédente, qui devient obsolète ; **Archiver** un document qui n'est plus utile.
:::

## Signer une version

Sur une version validée ou publiée, **Signer** ouvre **Signer la version** : cochez le consentement à la signature électronique, recevez un code (e-mail, SMS ou WhatsApp) et saisissez-le. La signature (identité, horodatage, empreinte) apparaît dans **Approbations et signatures** et constitue une preuve opposable.

## Liens

**Rattacher** ouvre **Rattacher le document** : liez-le à une tâche, un lot, une issue BIM, une commande, un incident…, puis **Ajouter**. **Retirer** supprime un rattachement (bloc **Rattachements**).

::: perm documents:approve
## Droits spécifiques et journal d'accès

- Onglet **Droits** (bloc **Droits spécifiques**) : ils s'ajoutent aux permissions de rôle ; « refus » masque le document. **Ajouter** ouvre **Droit spécifique** : utilisateur ou rôle, droit (lecture, écriture, approbation, signature, refus) ; **Retirer** pour annuler.
- Onglet **Journal d'accès** : qui a consulté ou téléchargé quoi, et quand.
:::

::: perm documents:write
## Supprimer un document

La corbeille ouvre **Supprimer le document** : une justification d'au moins 10 caractères est obligatoire. La suppression est logique et journalisée. Un plan, contrat, avenant, PV ou facture déjà publié ne peut être supprimé qu'avec le droit de publication.
:::
