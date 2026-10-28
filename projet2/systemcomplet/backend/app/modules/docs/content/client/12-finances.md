---
id: client-finances
title: Finances - appels de fonds, factures, paiements, échéanciers et séquestre
space: client
section: Mon projet
order: 50
route: /espace-client/finances
routes: [/espace-client/finances/paiement/*]
summary: Suivre le budget de votre contrat, payer en ligne un appel de fonds ou une facture (Mobile Money, carte), demander un échéancier, télécharger vos reçus et valider les libérations du séquestre par jalon.
keywords: [finances, paiement, payer, appel de fonds, facture, reçu, Mobile Money, MTN, Orange, carte, échéancier, échelonner, séquestre, libération, contester]
related: [client-financement, client-validations, client-preuves]
---

## Vue d'ensemble

Menu **Finances** : budget, appels de fonds, factures, paiements et reçus.

- Indicateurs : **Montant du contrat (avenants non inclus)**, **Avenants approuvés** (facturés séparément), **Appelé** (et reste à appeler sur le contrat), **Payé**, **À régler** (et appels en retard), barre **Part du contrat réglée**.
- **Appels de fonds** : numéro, **Objet**, **Échéance**, **Montant**, **Payé**, **Statut**.
- **Factures** : numéro, montant, échéance, statut ; l'icône de téléchargement ouvre le PDF.
- **Paiements et reçus** : chaque paiement avec son moyen, sa date, son statut ; **Reçu** télécharge le reçu. Un règlement fait hors ligne (virement, chèque, espèces, dépôt Mobile Money direct) y apparaît, avec son reçu, dès que GLOBUS l'a vérifié ; l'appel de fonds ou la facture passe alors « Payé » (ou « Partiellement payé »).

::: perm client:pay
## Payer en ligne

Le bouton **Payer** apparaît sur un appel de fonds ou une facture émis, partiellement payé ou en retard.

1. **Payer** ouvre **Paiement en ligne** : choisissez le moyen (Mobile Money MTN ou Orange, carte bancaire…). « Validation sur votre téléphone » ou « Page sécurisée de l'opérateur » indique le déroulé.
2. Pour Mobile Money, saisissez le **Numéro Mobile Money à débiter**.
3. Ajustez le **Montant** si besoin : le paiement partiel est possible, dans la limite du reste à régler.
4. **Payer …** : en Mobile Money, validez la demande reçue sur votre téléphone avec votre code secret ; par carte, vous êtes redirigé vers la page sécurisée de l'opérateur.
5. La page de suivi affiche « Validez le paiement sur votre téléphone » puis « Paiement en cours de confirmation », jusqu'à **Paiement confirmé** (**Télécharger le reçu**) ou **Paiement non abouti** (motif affiché). **Retour aux finances** ramène à la page.

> [!NOTE]
> Paiement réel sécurisé par l'opérateur : une seule opération est créée même en cas de double clic. Sans moyen de paiement activé, la fenêtre l'indique : contactez votre chargé d'affaires.

## Demander un échéancier

Le bouton **Échelonner** (à côté de **Payer**) propose de régler une pièce en plusieurs fois.

1. **Échelonner** ouvre **Demander un échéancier** : **Nombre d'échéances** (2 à 4 : une première d'au moins 25 %, puis des échéances mensuelles), **Votre situation (facultatif)**.
2. **Envoyer la demande** : statut « Demande à l'étude ».
3. GLOBUS vous propose un échéancier (statut « À accepter ») dans **Mes échéanciers** : **Accepter par code** ouvre **Accepter l'échéancier**.
4. Choisissez **Recevoir le code par** (e-mail, SMS ou WhatsApp), **Recevoir mon code**, saisissez le **Code reçu** puis **J'accepte l'échéancier** (**Renvoyer le code** si besoin).
:::

## Mes échéanciers

Chaque échéancier montre ses échéances (payées, à venir, en retard) et son statut : **Demande à l'étude**, **À accepter**, **En cours**, **Soldé**, **Échéance manquée**, **Non retenu**, **Annulé**. Des rappels automatiques sont envoyés avant chaque échéance, avec un lien de paiement en un clic ; ils remplacent les relances de la pièce d'origine.

## Séquestre par jalon

Lorsque votre contrat prévoit un séquestre, vos versements sont détenus par un établissement partenaire et ne sont libérés à GLOBUS qu'à l'atteinte prouvée de chaque jalon, avec votre accord. Le panneau **Séquestre par jalon** indique **Fonds sécurisés**, **Libérés à l'entreprise**, **Restitués**, puis chaque appel de fonds placé sous séquestre avec son statut : en attente du versement, fonds sécurisés, libération demandée, validée par le client, contestée, libérée, restituée. Tant que la convention n'est pas signée, un bandeau « Séquestre en cours de mise en place » l'indique.

::: perm client:decide
Quand GLOBUS demande une libération, les **Preuves de l'atteinte du jalon** (photos, procès-verbaux, avec lien « vérifier ») sont jointes :

- **Valider la libération** ouvre **Valider la libération des fonds** : recevez le code, saisissez-le puis **Je valide**. Les fonds sont libérés après double validation interne.
- **Contester** ouvre **Contester la demande de libération** : **Motif (15 caractères minimum)** puis **Contester**. Les fonds restent bloqués et votre chef de projet vous recontacte ; un litige non résolu suit la procédure prévue au contrat.
:::
