---
id: erp-fournisseurs
title: Fournisseurs
space: erp
section: Achats et logistique
order: 30
route: /erp/fournisseurs
routes: [/erp/fournisseurs/*]
perms: [suppliers:read]
summary: Référentiel des fournisseurs - catalogue et tarifs, documents légaux, performance, incidents, contacts et canal WhatsApp ; comparateur multi-fournisseurs.
keywords: [fournisseur, catalogue, tarif, document légal, attestation, incident, notation, performance, comparateur, contact]
related: [erp-achats, erp-livraisons, erp-facturation]
---

## La liste

Menu **Achats et logistique › Fournisseurs** : référentiel, catalogue et tarifs, documents légaux, performance, canal WhatsApp. Filtre **Statut** (actif, en qualification, suspendu, liste noire).

::: perm suppliers:write
### Créer un fournisseur

**Nouveau fournisseur** : **Raison sociale** obligatoire ; nom commercial, forme juridique, NIU, RCCM, adresse, catégories, zones de livraison, conditions et délai de paiement, commande minimum, délai de livraison, coordonnées, **Numéro WhatsApp** et **Accepte WhatsApp**, **Canal préféré**, coordonnées bancaires et Mobile Money, **Organisation (accès extranet)** (organisation de type « fournisseur » créée dans Administration › Utilisateurs et rôles › Organisations ; une organisation ne peut être reliée qu'à une seule fiche), contacts. Les comptes de cette organisation ouvrent ensuite l'extranet fournisseur.
:::

## La fiche fournisseur

Onglets **Profil**, **Catalogue et tarifs**, **Commandes**, **Documents**, **Performance**, **Incidents**, **Contacts**.

::: perm suppliers:write
- **Modifier** ouvre **Modifier le fournisseur**.
- **Changer le statut** ouvre **Statut du fournisseur** (motif obligatoire pour une suspension ou une mise en liste noire).
- **Documents légaux et qualité** : **Ajouter un document** (attestation fiscale, CNPS, assurance, certificat, avec date d'expiration) puis **Marquer vérifié** après contrôle. Les documents expirés sont signalés.
:::

- **Performance** : **Achats sur 12 mois** (total), taux de livraison à l'heure, qualité des réceptions, **Notes**.
- **Noter** ouvre **Noter le fournisseur** (qualité, délai, service, commentaire).

### Catalogue et tarifs

Le **Catalogue** alimente le classement automatique des fournisseurs et l'indice des prix.

::: perm suppliers:write
- **Nouveau produit** : fournisseur, **Référence** et nom obligatoires ; article de stock lié, catégorie, unité, **Prix unitaire**, quantité minimum, délai, stock disponible, **Prix valable jusqu'au**.
:::

### Incidents et contacts

::: perm procurement:order, suppliers:write
- **Déclarer un incident** : type obligatoire (retard, non-conformité, casse, erreur de facturation…), **Bon de commande concerné** (commandes de ce fournisseur) et **Réception concernée** (ses réceptions) choisis dans des listes, description, **Impact financier**. L'incident est ouvert ; **Résoudre** le clôt avec sa résolution.
:::

::: perm procurement:order
- **Résoudre** : saisissez la **Résolution** et l'impact financier final.
:::

::: perm suppliers:write
- **Nouveau contact** : nom, type (commercial, logistique, comptabilité), e-mail, téléphone, WhatsApp, **Principal**.
:::

## Comparateur multi-fournisseurs

Le **Comparateur multi-fournisseurs** affiche, pour un article, prix, délai, stock et qualité de tous les fournisseurs actifs : choisissez l'article puis **Comparer**.
