---
id: erp-application-direction
title: L'application mobile GLOBUS Direction
space: erp
section: Prise en main
order: 16
routes: [/erp/tableau-de-bord, /erp/validations]
summary: Piloter l'entreprise depuis le téléphone — tableau de bord, validations en attente, chantiers, achats, finance, commercial, RH, sécurité — avec les mêmes droits que l'ERP web.
keywords: [application, mobile, direction, validation, approbation, tableau de bord, paiement, achat, situation, congé, rapport, android, iphone]
related: [erp-tableau-de-bord, erp-achats, erp-finances, erp-situations, erp-rapport-direction, erp-securite]
---

## Se connecter

**GLOBUS Direction** (Android et iPhone) s'adresse à la direction et aux responsables (achats, finance, RH, QHSE,
commercial, administration). Connectez-vous avec votre compte ERP ; la double authentification est obligatoire pour ces
profils. Chaque rubrique n'apparaît que si votre rôle y donne droit, exactement comme dans l'ERP web.

## Pilotage

- **Tableau de bord** : chantiers actifs et avancement moyen, jalons en retard, incidents graves, tickets SAV ;
  chiffre d'affaires signé, facturé, créances (dont en retard), dettes fournisseurs ; trésorerie prévisionnelle sur
  6 mois ; marges par chantier (les plus faibles d'abord) ; santé des chantiers ; satisfaction client ; livraisons
  attendues ; contrôles (factures en anomalie, litiges, anomalies IA) ; performance des partenaires ; entonnoir
  commercial. Tirez vers le bas pour actualiser.
- **Rapport de direction** : rapport hebdomadaire (points clés, risques, décisions à prendre, perspectives, chiffres)
  et son PDF ; **Générer** recalcule la semaine écoulée.
- **Anomalies (IA)** : doublons de factures, prix hors norme, paiements inhabituels… à **Examiner** (confirmer ou écarter).

## Valider en déplacement

L'onglet **Validations** regroupe tout ce qui attend votre décision :

| Onglet | Action |
|---|---|
| Achats | Demandes d'achat arrivées à **votre** niveau du circuit : **Approuver** ou **Refuser** (motif) |
| Commandes | Bons de commande à approuver |
| Paiements | Paiements sortants : **Approuver** (motif de dérogation si un contrôle interne bloque) |
| Situations | Situations de sous-traitance contrôlées sur le terrain : **Valider**, **Refuser**, **Dérogation** |
| Factures | Factures fournisseurs en écart de rapprochement : **Traiter l'écart** |
| Congés | Demandes de congé : **Accepter** ou **Refuser** |
| Documents | Versions en revue : faire avancer (valider, publier, demander une correction) |
| Actions QHSE | Actions terminées à vérifier : **Vérifier** ou **Rouvrir** |
| Décisions client | Suivi des décisions soumises aux clients et sans réponse |

Chaque action ouvre un court formulaire en français (aucun code à saisir : les projets, fournisseurs ou personnes se
choisissent dans une liste) ; elle est tracée dans le journal d'audit comme sur le web. Une notification touchée ouvre
directement la fiche concernée.

## Gérer

- **Chantiers** : portefeuille filtrable (statut, santé) ; fiche avec indicateurs, budget (engagé, dépensé, marge
  prévue), indice de confiance, **synthèse de la semaine rédigée par l'IA** (à relire avant diffusion), planning et
  tâches en retard, décisions, photos récentes et incidents.
- **Achats et logistique**, **Sous-traitance**, **Finance**, **Commercial**, **RH et QHSE** : listes avec recherche et
  filtres, fiche détaillée, créations et actions autorisées (envoyer un bon de commande, relancer une facture, émettre
  un appel de fonds, convertir un lead, envoyer un devis, calculer et valider la paie…), documents PDF.
- **Administration** : utilisateurs (créer, modifier, déverrouiller, déconnecter partout, réinitialiser la double
  authentification après vérification d'identité), sécurité (adoption de la double authentification, comptes
  verrouillés, alertes), sessions actives, journal d'audit.

La gestion du site web (contenus, SEO, médiathèque, newsletter) reste dans l'ERP web.
