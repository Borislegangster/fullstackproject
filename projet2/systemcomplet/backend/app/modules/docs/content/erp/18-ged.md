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

Menu **Projets › GED** (ou **Documents (GED)** depuis la fiche projet). Les documents s'organisent par projet et par dossiers ; filtres **Type**, **Discipline**, **Statut**. Les documents confidentiels ou très sensibles ne sont visibles qu'avec l'habilitation correspondante.

::: perm documents:write
## Déposer un document

1. **Déposer un document** : projet, dossier, type (plan, note de calcul, contrat, PV…), discipline, code et titre, confidentialité, puis le fichier ; **Déposer**.
2. Le document est créé en brouillon (version 1).
3. **Nouveau dossier** (fenêtre du même nom) organise l'arborescence d'un projet : nom et **Confidentialité par défaut** (proposée à chaque dépôt dans ce dossier, reprise du dossier parent) ; **Créer**.
:::

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
- **Valider** ou renvoyer en **correction** avec un commentaire.
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
