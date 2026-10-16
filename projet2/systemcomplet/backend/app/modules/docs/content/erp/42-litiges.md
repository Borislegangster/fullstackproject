---
id: erp-litiges
title: Litiges et réclamations
space: erp
section: Sous-traitance
order: 30
route: /erp/litiges
routes: [/erp/litiges/*]
perms: [disputes:read]
summary: Litiges avec fournisseurs et sous-traitants - montants gelés, preuves, chronologie horodatée non modifiable, décision et résolution ; réclamations des partenaires.
keywords: [litige, réclamation, contestation, décision, escalade, chronologie, montant gelé, avoir]
related: [erp-sous-traitants, erp-situations, erp-facturation]
---

## Accès

Menu **Sous-traitance › Litiges**. Deux onglets : **Litiges** et **Réclamations** (voir aussi [Sous-traitance](doc:erp-sous-traitants) pour répondre aux réclamations).

## Onglet « Litiges »

Les **Litiges** : statuts, montants gelés, preuves, chronologie horodatée, décision et résolution (avoir). Filtres **Statut** et **Partie**. Statuts : ouvert → en analyse → en négociation → décision → résolu (ou escaladé).

::: perm disputes:write
### Ouvrir un litige

**Ouvrir un litige** ouvre **Ouvrir un litige** : partie (fournisseur ou sous-traitant), objet lié (commande, situation, facture), titre, description, montant en jeu (gelé : il ne peut pas être payé tant que le litige est ouvert), pièces ; **Ouvrir le litige**.

### Faire avancer le litige

- **Faire évoluer** ouvre **Faire évoluer le litige** : passage en analyse, en négociation, ou en décision.
- **Ajouter à la chronologie** ouvre **Ajouter à la chronologie** : échange, proposition, preuve (**Pièce**). La **Chronologie** est un journal horodaté et non modifiable.
:::

::: perm disputes:decide
### Décider et clore

- L'escalade (statut « escaladé ») est réservée aux décideurs.
- **Décision** ouvre **Décision** : décision motivée, montant retenu, avoir éventuel.
- **Clore (résolu)** ouvre **Clore le litige** : les montants gelés sont libérés selon la décision.
:::

## Onglet « Réclamations »

Travaux supplémentaires, aléas, demandes de rémunération complémentaire déposés par les partenaires : une réponse écrite leur est due. Une réclamation refusée peut être escaladée en litige.
