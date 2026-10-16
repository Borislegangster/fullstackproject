---
id: erp-materiel
title: Matériel et engins
space: erp
section: Achats et logistique
order: 60
route: /erp/materiel
routes: [/erp/materiel/*]
perms: [equipment:read]
summary: Parc de matériel, affectations aux chantiers, relevés d'utilisation, position GPS, maintenance préventive et corrective, consommables, incidents et coûts.
keywords: [matériel, engin, véhicule, outillage, affectation, maintenance, panne, consommable, compteur, GPS, QR]
related: [erp-stocks, erp-chantiers]
---

## La liste du matériel

Menu **Achats et logistique › Matériel**. Le **Matériel** regroupe le parc (engins, véhicules, outillage, échafaudages, topographie, informatique), les affectations chantier, l'utilisation, la maintenance, les consommables, les incidents et les coûts. Filtres **Statut** et **Catégorie**.

::: perm equipment:write
### Ajouter du matériel

**Nouveau matériel** : nom obligatoire ; code, catégorie, marque, modèle, n° de série, immatriculation, date et coût d'acquisition, propriété (en propre, loué, crédit-bail) et loueur, état, coûts horaire et journalier, compteurs (heures, kilomètres), balise GPS, échéances d'assurance et de contrôle technique, notes.
:::

## La fiche matériel

Onglets **Fiche**, **Utilisation**, **Maintenance**, **Incidents**, **Consommables**, **Coûts**. **Étiquette QR** imprime l'étiquette à coller sur le matériel (le scan ouvre sa fiche sur le terrain).

::: perm equipment:write
### Fiche et affectations

- **Modifier** ouvre **Modifier le matériel**.
- **Affecter à un chantier** ouvre **Affecter à un chantier** (projet, chantier, dates) ; **Retour au dépôt** ouvre **Retour au dépôt** (date, compteur, état). Historique dans **Affectations**.
- **Mettre à jour la position** ouvre **Position du matériel** (localisation manuelle si pas de balise).
- **Ajouter un document** ouvre **Ajouter un document** (carte grise, assurance, notice).

### Utilisation

**Saisir un relevé** ouvre **Relevé d'utilisation** (date, heures ou kilomètres, chantier). Les **Relevés d'utilisation** alimentent la maintenance préventive et les coûts.
:::

### Maintenance

- **Plans de maintenance préventive** : intervalle en jours et / ou en heures moteur, prochaine échéance calculée.
- **Ordres de maintenance** : préventifs générés par les plans ou correctifs.

::: perm maintenance:manage, equipment:write
- **Nouveau plan** : matériel et titre obligatoires, intervalles, dernière réalisation, compteur, prochaine échéance.
- **Nouvel ordre** ouvre **Ordre de maintenance** (type, date prévue, description).
- **Démarrer** l'intervention (le matériel devient indisponible), puis **Terminer** : coût, immobilisation (heures), **Rapport** obligatoire et état après intervention.
:::

::: perm maintenance:manage
- Supprimer un plan de maintenance depuis sa fiche.
:::

::: perm equipment:write
### Incidents et consommables

- **Déclarer un incident** ouvre **Déclarer un incident** : panne, dommage, vol ou accident, date, description, coût estimé, photos. Le bloc **Incidents (panne, dommage, vol, accident)** liste les incidents ; **Résolu** les clôt.
- **Consommables** (huiles, filtres, lames…) : **Nouveau consommable** (matériel et nom obligatoires, article de stock, intervalle de remplacement en heures, dernier remplacement, quantité par remplacement).
:::

## Coûts

L'onglet **Coûts** totalise acquisition ou location, maintenance, consommables et incidents, et le coût d'utilisation imputé aux chantiers.
