---
id: extranet-commandes
title: Commandes - confirmer, contre-proposer, expédier, facturer
space: extranet
section: Fournitures
order: 10
route: /extranet/commandes
routes: [/extranet/commandes/*]
spaces: [extranet_supplier]
summary: Traiter un bon de commande GLOBUS de bout en bout - confirmer ou refuser, proposer une contre-offre (prix, quantités, date), annoncer l'expédition et déposer la facture.
keywords: [commande, bon de commande, confirmer, refuser, contre-offre, expédition, livraison, transporteur, facture, TVA, urgent]
related: [extranet-livraisons, extranet-factures, extranet-performance]
---

## Liste des commandes

Menu **Fournitures › Commandes** (**Mes commandes**) : **Commande**, **Chantier**, **Livraison souhaitée**, **Montant TTC**, badge **Urgent**, **Statut** (envoyée, consultée, confirmée, contre-offre, refusée, expédiée, partiellement reçue, reçue, facturée, clôturée, annulée). Filtrez par statut avec la liste **Toutes**.

## Lire une commande

Ouvrez la commande : **Bon de commande** n°, badge **Urgent**, **PDF** du bon. Détails : **Date d'envoi**, **Livraison souhaitée**, **Adresse de livraison**, **Conditions de paiement**, **Arrivée annoncée** ; **Articles commandés** (quantité, prix unitaire, total HT, déjà facturé) ; totaux HT et TTC ; **Livraisons** et **Factures** déjà enregistrées.

## Répondre

Les boutons ne s'affichent que lorsque l'action est possible :

- **Confirmer la commande** : **Votre nom**, **Commentaire (facultatif)**, puis confirmez. Vous vous engagez sur les prix, quantités et date.
- **Refuser** ouvre **Refuser la commande** : **Votre nom** et **Motif du refus** (obligatoire).
- **Proposer une contre-offre** ouvre la fenêtre du même nom : indiquez uniquement ce que vous proposez de modifier — **Prix unitaire proposé**, **Quantité proposée** par article —, la **Date de livraison proposée**, **Votre nom** et un **Message**, puis envoyez. Le bandeau **Contre-offre transmise** rappelle votre proposition en attendant la réponse de GLOBUS.

## Annoncer une expédition

**Annoncer une expédition** ouvre la fenêtre du même nom : **Arrivée estimée** (obligatoire), **Transporteur**, **N° de suivi**, **Immatriculation**, **N° bon de livraison**, **Chauffeur**, **Téléphone du chauffeur**, puis **Annoncer**. Le chantier est prévenu et prépare la réception (voir [Livraisons](doc:extranet-livraisons)).

## Déposer une facture

**Déposer une facture** (après livraison) ouvre la fenêtre du même nom :

1. **Numéro de votre facture**, **Date de facture**, **Échéance**, **Montant de TVA**.
2. Pour chaque article : **Qté facturée** et **Prix unitaire HT** (pré-remplis avec la quantité acceptée à la réception et non encore facturée ; « Accepté » et « déjà facturé » sont rappelés).
3. **Facture (PDF ou image)** (20 Mo maximum), puis **Déposer la facture**.

> [!NOTE]
> Chaque facture fait l'objet d'un contrôle à 3 pièces : commande, réception sur chantier, facture. La colonne **Contrôle** de vos [factures](doc:extranet-factures) indique « Conforme » ou un écart (quantité non reçue, prix différent) à régler avec l'acheteur avant mise en paiement.

## Sans compte : le lien reçu par WhatsApp ou e-mail

Un fournisseur sans compte extranet reçoit un lien sécurisé personnel vers chaque bon de commande : la même page permet de confirmer, refuser, contre-proposer, annoncer l'expédition et déposer la facture.
