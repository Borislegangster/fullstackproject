---
id: erp-chantier-patrimoine
title: Fiche projet - Tranquillité, garanties, bâtiment et énergie
space: erp
section: Chantier (fiche projet)
order: 40
routes: [/erp/chantiers/*?onglet=tranquillite, /erp/chantiers/*?onglet=garanties, /erp/chantiers/*?onglet=batiment, /erp/chantiers/*?onglet=energie, /erp/chantiers/*/tranquillite, /erp/chantiers/*/garanties, /erp/chantiers/*/batiment, /erp/chantiers/*/energie]
perms: [projects:read]
summary: Dossier Tranquillité (foncier, permis, actes), garanties légales, passeport du bâtiment avec carnet d'entretien et études énergie et confort demandées par le client.
keywords: [tranquillité, foncier, permis, titre foncier, garantie, décennale, parfait achèvement, équipement, notice, entretien, passeport, énergie, solaire, avenant]
related: [erp-chantiers, erp-sav]
---

## Onglet « Tranquillité »

Le **Dossier Tranquillité** suit les pièces foncières et administratives : foncier, permis, actes notariés — statut, échéances, preuves, vérifications et ancrage d'empreinte. Le client en voit l'état dans son espace.

::: perm projects:write
1. **Nouvelle pièce** : catégorie et **Titre** (obligatoires), numéro de référence, autorité, statut, dates (délivrance, expiration, échéance), responsable, documents de preuve choisis dans la GED du projet, **Visible par le client**.
2. Ouvrez une pièce puis **Vérifier** : choisissez le statut (en vérification, vérifiée, anomalie, expirée, en cours) et notez la vérification ; l'empreinte des documents peut être ancrée (preuve opposable).
:::

## Onglet « Garanties »

Garanties légales et contractuelles (parfait achèvement, biennale, décennale, équipements) : elles déterminent la prise en charge des demandes SAV.

::: perm projects:write
- **Nouvelle garantie** : type, **Date de début** et **Date de fin** (obligatoires), couverture, assureur, **N° de police**.
:::

## Onglet « Bâtiment et maintenance »

Le **Passeport du bâtiment** réunit équipements installés, notices, garanties et carnet d'entretien : il est remis au client à la réception, certifié et transmissible en cas de revente.

- **Passeport certifié (PDF)** génère le passeport avec sa preuve (QR de vérification).
- **Notice** ouvre la notice d'un équipement.

::: perm projects:write
### Équipements

1. **Ajouter un équipement** : catégorie (climatisation, plomberie, pompe et surpresseur, fosse septique, électricité, solaire, groupe électrogène, toiture, menuiserie, peinture, autre) et nom (obligatoires), marque, modèle, n° de série, localisation, zone, dates de pose et de fin de garantie, intervalle d'entretien (vide = carnet type de la catégorie), notes, visibilité client.
2. Le carnet d'entretien type est programmé automatiquement.
3. **Ajouter la notice** (PDF ou image) pour la rendre consultable par le client ; **Remplacer la notice** si besoin.
4. Le crayon modifie l'équipement ; la corbeille ouvre **Supprimer l'équipement** (ses entretiens programmés sont supprimés).

### Carnet d'entretien

Rappels automatiques au client 14 jours avant chaque échéance et la veille. **Fait** enregistre la réalisation : l'occurrence suivante est programmée.
:::

::: perm support:write
- **Intervention** ouvre **Planifier une intervention** : un ticket SAV pré-rempli est créé (précisions facultatives pour le technicien).
:::

## Onglet « Énergie »

Les études énergie et confort enregistrées par le client (isolation, protections solaires, climatisation inverter, LED, solaire, batterie) avec facture avant / après, investissement, retour sur investissement et autonomie en délestage.

::: perm projects:write
Quand le client clique « Intégrer à mon projet » (statut « demandé ») :

1. **Préparer l'avenant** ouvre l'onglet Avenants pour chiffrer les mesures retenues.
2. Une fois l'avenant transmis, **Marquer chiffrée** clôt la demande.
:::
