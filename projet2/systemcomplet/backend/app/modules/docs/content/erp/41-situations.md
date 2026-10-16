---
id: erp-situations
title: Situations de travaux
space: erp
section: Sous-traitance
order: 20
route: /erp/situations
routes: [/erp/situations/*]
perms: [subcontracting:read]
summary: Avancement déclaré par les sous-traitants avec photos, constat terrain, validation bloquée au-delà du marché sans dérogation, facture et paiement.
keywords: [situation, avancement, sous-traitant, constat, dérogation, facture, photos]
related: [erp-sous-traitants, erp-facturation, erp-litiges]
---

## Le circuit

Soumission avec photos → constat terrain → validation (bloquée au-delà du montant du marché sans dérogation) → facture → paiement. Menu **Sous-traitance › Situations** ; filtre **Statut**. Les situations sont généralement soumises par le sous-traitant depuis son extranet.

## La fiche situation

**Situation …** présente l'**Avancement par poste** (cumul précédent, période, cumul) et les **Photos d'avancement**, obligatoires pour la soumission (preuves datées et géolocalisées).

::: perm subcontracting:write
### Saisir une situation pour le sous-traitant

1. Depuis le marché, **Nouvelle situation** (fenêtre **Nouvelle situation de travaux**) : période, puis **Créer la situation**.
2. Renseignez l'avancement de chaque poste, **Envoyer les photos**, puis **Soumettre**.
:::

::: perm subcontracting:validate, site:report
### Constat terrain

Sur une situation soumise, **Constat terrain** ouvre **Constat terrain** : quantités constatées sur site par poste, observations, photos ; **Enregistrer le constat**.
:::

::: perm subcontracting:derogate
### Dérogation

Si le cumul dépasse le montant du marché, la validation est bloquée : **Accorder une dérogation** ouvre **Dérogation au montant du marché** (justification obligatoire).
:::

::: perm subcontracting:validate
### Valider ou rejeter

Après constat, **Valider** ouvre **Valider la situation** (montants, retenue de garantie et récupération d'avance calculées) ; **Rejeter** ouvre **Rejeter la situation** (motif communiqué au sous-traitant).
:::

::: perm billing:write
### Facturer

Sur une situation validée, **Facture** ouvre **Facture du sous-traitant** : numéro et date de la facture reçue, puis **Enregistrer la facture**. **Facture (PDF)** ouvre la pièce ; la validation pour paiement se fait dans [Sous-traitance › Factures](doc:erp-sous-traitants).
:::

En cas de désaccord sur les quantités ou les pénalités, ouvrez un litige : voir [Litiges](doc:erp-litiges).
