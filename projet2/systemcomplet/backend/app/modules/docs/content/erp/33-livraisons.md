---
id: erp-livraisons
title: Livraisons, réceptions et retours
space: erp
section: Achats et logistique
order: 40
route: /erp/livraisons
routes: [/erp/livraisons/*, /erp/livraisons/receptions, /erp/livraisons/receptions/nouvelle, /erp/livraisons/receptions/*]
perms: [deliveries:read]
summary: Expéditions annoncées, arrivées sur chantier, réceptions contrôlées avec preuves (bon de réception), écarts, substitutions et retours fournisseurs.
keywords: [livraison, réception, GRN, bon de livraison, écart, manquant, endommagé, retour, substitution, QR]
related: [erp-achats, erp-stocks, erp-fournisseurs]
---

## Accès

Menu **Achats et logistique › Livraisons** (écran **Livraisons et réceptions**). Onglets **Livraisons**, **Réceptions**, **Retours fournisseurs**.

## Onglet « Livraisons »

Les **Livraisons** annoncées par les fournisseurs (extranet, WhatsApp, saisie) et leur arrivée sur chantier. Filtre **Statut**. La fiche détaille les **Articles de la commande** et les **Réceptions** déjà faites.

::: perm deliveries:receive
- **Signaler l'arrivée** ouvre **Arrivée sur chantier** (date et heure, position) : le conducteur de travaux est prévenu.
- **Réceptionner** démarre la réception de cette livraison.
:::

::: perm deliveries:receive
## Faire une réception

1. **Nouvelle réception** (onglet Réceptions) : scannez le QR du bon de commande (bouton **QR réception** du BC) ou saisissez son numéro puis **Rechercher**.
2. **Contrôle des quantités** : pour chaque ligne, saisissez le reçu et le refusé ; tout écart (manquant, endommagé, non conforme) crée un incident fournisseur.
3. Ajoutez les preuves : photos, bon de livraison signé, signature du livreur (**Ajouter la pièce**).
4. **Enregistrer en brouillon** pour terminer plus tard, ou **Enregistrer et valider**.
5. Une réception en brouillon se termine avec **Valider** (fenêtre **Valider la réception**) : le stock est mis à jour et la facture pourra être rapprochée (3 pièces).
:::

## Onglet « Réceptions »

Les **Réceptions (GRN)** : quantités reçues, acceptées, refusées, preuves et écarts. Filtres **Statut** et **Écarts**. La fiche présente les **Lignes réceptionnées** et les **Preuves**.

::: perm deliveries:receive
- Sur une réception validée avec écarts, **Retour fournisseur** ouvre **Retour fournisseur** : lignes, quantités et motif du retour.
:::

::: perm procurement:order
- Si le fournisseur a livré un article de substitution, **Accepter** ou **Refuser** la substitution.
:::

## Onglet « Retours fournisseurs »

Suivi des retours jusqu'à leur règlement.

::: perm deliveries:receive, procurement:order
- **Mettre à jour** : statut (expédié, crédité par un avoir, clôturé) et avoir associé.
:::
