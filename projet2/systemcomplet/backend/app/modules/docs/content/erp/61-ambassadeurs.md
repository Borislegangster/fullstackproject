---
id: erp-ambassadeurs
title: Programme ambassadeurs
space: erp
section: Commercial
order: 20
route: /erp/crm/ambassadeurs
perms: [crm:read]
summary: Recommandations des clients et prescripteurs, primes calculées à la signature, validation puis paiement par Mobile Money via le circuit finance.
keywords: [ambassadeur, parrainage, recommandation, prime, prescripteur, Mobile Money, activer, ouvrir, fermer, règles]
related: [erp-crm, erp-finances]
---

## Principe

Menu **Commercial › Ambassadeurs** (écran **Programme ambassadeurs**). Clients et prescripteurs recommandent GLOBUS avec leur code personnel ; la prime est calculée à la signature du contrat du filleul, validée ici, puis payée par Mobile Money via le circuit finance. Deux onglets : **Recommandations** et **Ambassadeurs**.

## Ouvrir ou fermer le programme

Le programme est **fermé par défaut** : tant qu'il l'est, le menu **Parrainage** n'apparaît pas dans l'espace client, aucun client ne peut adhérer, les liens ambassadeurs ne sont plus attribués et **Nouveau prescripteur** est désactivé. La carte en haut de l'écran indique **Programme ouvert** (« Visible des clients ») ou **Programme fermé** (« Masqué des clients ») et rappelle les règles de prime.

::: perm settings:write
1. **Ouvrir le programme** ouvre la fenêtre du même nom : confirmez avec **Ouvrir**. Le menu **Parrainage** apparaît aussitôt chez tous les clients (à leur prochain chargement de page).
2. **Fermer le programme** (fenêtre du même nom, **Fermer**) le masque à nouveau ; les recommandations déjà enregistrées et les primes dues continuent d'être traitées.
3. **Règles** ouvre **Règles du programme** : **Type de prime** (pourcentage du contrat ou montant fixe), **Pourcentage (%)** ou **Montant fixe (FCFA)**, **Plafond de prime (FCFA)**, **Montant minimum du contrat (FCFA)**, **Durée de suivi du lien (jours)**, **Délai de signature du contrat (jours)**, **Avantage proposé au filleul**, puis **Enregistrer**. Les nouvelles règles s'appliquent aux recommandations suivantes.

Chaque ouverture, fermeture ou changement de règle est inscrit au [journal d'audit](doc:erp-audit).
:::

## Onglet « Recommandations »

Sous-onglets : **Primes à valider**, **À payer**, **En cours**, **Payées**, **Non éligibles**, **Toutes**. Chaque ligne : ambassadeur, filleul (**Voir le lead**), statut, montant de la prime.

::: perm crm:contracts
- **Valider** une prime dont le contrat est signé ; **Refuser** ouvre **Refuser la prime** (motif communiqué à l'ambassadeur).
:::

::: perm finance:pay
- **Initier le paiement** crée l'ordre de paiement (Mobile Money de l'ambassadeur) soumis au double regard habituel ([Finances](doc:erp-finances)).
:::

## Onglet « Ambassadeurs »

Liste des ambassadeurs, leur code, nombre de recommandations et primes.

::: perm crm:write
- **Nouveau prescripteur** ouvre **Nouveau prescripteur** (architecte, agent immobilier, notaire…) : nom, contact, numéro Mobile Money ; **Inscrire** crée son code personnel. Les clients s'inscrivent eux-mêmes depuis leur espace.
:::

> [!WARNING]
> Toute modification du numéro de paiement d'un ambassadeur déclenche un contrôle anti-fraude avant le versement suivant.
