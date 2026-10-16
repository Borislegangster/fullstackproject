---
id: erp-chantier-jumeau-sequestre
title: Fiche projet - jumeau numérique et séquestre par jalon
space: erp
section: Chantier (fiche projet)
order: 50
routes: [/erp/chantiers/*?onglet=jumeau, /erp/chantiers/*?onglet=sequestre, /erp/chantiers/*/jumeau, /erp/chantiers/*/sequestre]
perms: [projects:read]
summary: Mesurer l'avancement réel par l'image puis le certifier, et gérer le séquestre - convention, appels de fonds placés sous séquestre, demandes de libération sur preuve, double validation et médiation.
keywords: [jumeau, avancement, photo, IA, certification, séquestre, libération, convention, notaire, banque, contestation, médiation]
related: [erp-sequestre, erp-chantier-planning, erp-facturation]
---

## Onglet « Jumeau numérique »

Les photos récentes du chantier sont confrontées au planning et à la maquette : l'IA propose un avancement observé par tâche, avec un niveau de confiance et l'élément visuel qui le justifie. Un responsable valide ou corrige, puis la mesure est certifiée et partagée au client. Sans IA configurée, aucune mesure n'est produite (rien n'est estimé au hasard).

::: perm projects:write
::: perm ai:use
### Mesurer l'avancement

1. Choisissez éventuellement une **Zone** (sinon tout le chantier).
2. Cliquez **Mesurer l'avancement** (photos datées de moins de 14 jours nécessaires).
:::

### Valider ou rejeter une mesure

1. Dans la mesure « en attente », comparez pour chaque tâche **Prévu**, **Déclaré** et **Observé (IA)** ; les écarts importants sont surlignés, les **Points d'attention** listés.
2. Corrigez si besoin la colonne **Retenu** (vide = valeur observée).
3. **Valider et certifier** : l'avancement des tâches est mis à jour et la mesure est scellée (preuve). **Rejeter** ouvre **Rejeter la mesure** (motif obligatoire).
:::

## Onglet « Séquestre »

Les versements du client peuvent être détenus par une banque ou un notaire partenaire et libérés jalon par jalon, sur preuve (PV publié et photos certifiées) et avec l'accord du client, puis après double validation interne. Aucun fonds n'est réputé sous séquestre tant que la convention n'est pas active, et rien n'est jamais libéré automatiquement.

::: perm finance:approve
### Mettre en place la convention

**Configurer le séquestre** (ou **Convention** si elle existe) ouvre **Convention de séquestre** : partenaire (banque ou notaire), référence de la convention (requise pour l'activation), délai de réponse du client (jours), conditions.
:::

::: role DIRECTION, ADMIN
Après signature de la convention, **Activer** ouvre **Activer le séquestre** : confirmez. Les versements du client sur les appels rattachés sont alors comptabilisés sous séquestre.
:::

::: perm finance:write
### Placer un appel de fonds sous séquestre

Choisissez un **Appel de fonds (non réglé)** et le **Jalon déclencheur**, puis **Placer sous séquestre**. Le rattachement se fait avant tout paiement.
:::

::: perm projects:write
### Demander la libération

Quand le jalon est atteint et les fonds intégralement sécurisés : **Demander la libération** ouvre **Demande de libération** ; choisissez le **Procès-verbal publié (type PV)**. Le PV et les photos certifiées des 21 derniers jours sont joints automatiquement et le client est notifié.
:::

::: perm finance:approve
### Valider la libération (double validation)

Après accord du client (code OTP), **Valider la libération** ouvre **Valider la libération** : la première validation est enregistrée ; une seconde personne (Finance ou Direction) valide à son tour en saisissant la référence de l'ordre transmis au partenaire, ce qui exécute la libération.
:::

::: role DIRECTION, ADMIN
### Médiation

Si le client conteste, **Médiation** ouvre **Médiation de la contestation** : décidez de reprendre le circuit de libération ou de restituer les fonds au client, avec un compte rendu (au moins 10 caractères).
:::

Le portefeuille de tous les projets est dans [Séquestre par jalon](doc:erp-sequestre).
