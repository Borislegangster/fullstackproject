---
id: erp-audit
title: Journal d'audit
space: erp
section: Administration
order: 50
route: /erp/audit
perms: [audit:read]
summary: Traçabilité infalsifiable (chaînage cryptographique) de toutes les actions métier, sécurité et système - recherche, détail d'un événement et vérification d'intégrité.
keywords: [audit, journal, traçabilité, historique, qui a fait quoi, intégrité, chaîne, preuve]
related: [erp-securite, erp-utilisateurs]
---

## Accès

Menu **Administration › Journal d'audit** : chaque action métier (validation, paiement, signature…), de sécurité (connexion, MFA, rôles) et système (sauvegarde, maintenance) est enregistrée et chaînée cryptographiquement ; aucun événement ne peut être modifié ou supprimé sans que la chaîne le révèle.

## Rechercher

Filtres : famille (**Métier**, sécurité, système…), criticité, période **Du** / **Au**, **Auteur**, module, action, ressource. Le tableau affiche **Auteur**, **Action**, **Ressource**, **Résultat** et **Criticité** ; **Précédent** / **Suivant** pour paginer.

## Détail d'un événement

Cliquez une ligne : la fenêtre **Événement n° …** montre l'horodatage, la famille et le module, l'auteur, l'application, l'adresse IP, la ressource, le projet, le résultat, la criticité, l'identifiant de requête, le **Motif** éventuel et les **Modifications** (valeurs avant / après).

## Vérifier l'intégrité

**Vérifier l'intégrité** recalcule toute la chaîne :

- **Chaîne d'audit intègre** : nombre d'événements vérifiés ;
- **Rupture de la chaîne d'audit détectée** : numéro du premier événement altéré — à signaler immédiatement à la direction et à traiter comme un incident de sécurité.
