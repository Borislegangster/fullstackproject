---
id: erp-sous-traitants
title: Sous-traitance - partenaires, consultations et marchés
space: erp
section: Sous-traitance
order: 10
route: /erp/sous-traitants
routes: [/erp/sous-traitants/*, /erp/sous-traitants/consultations, /erp/sous-traitants/consultations/*, /erp/sous-traitants/marches, /erp/sous-traitants/marches/*]
perms: [subcontracting:read]
summary: Qualification des sous-traitants, consultations multi-lots sous pli scellé, comparatif, négociation, attribution, marchés signés par code, mobilisation, avance, retenue de garantie, factures et réclamations.
keywords: [sous-traitant, consultation, appel d'offres, offre, pli scellé, attribution, marché, contrat, retenue de garantie, avance, mobilisation, réclamation]
related: [erp-situations, erp-litiges, erp-facturation]
---

## Le cycle

Qualification → consultation → comparatif → contrat → mobilisation → situations → contrôle → facture → paiement → litige éventuel → clôture. Menu **Sous-traitance › Sous-traitants** ; onglets **Sous-traitants**, **Consultations**, **Marchés**, **Factures**, **Réclamations**.

## Onglet « Sous-traitants »

Les **Sous-traitants** : qualification (critères, références, assurances), historique, notation et score. Filtres **Statut** et **Corps de métier**.

Les corps de métier se choisissent toujours dans une liste commune, rangée par famille : terrassement et gros œuvre (terrassement, démolition, gros œuvre, maçonnerie, ferraillage, coffrage, structure), clos et couvert (charpente, couverture, étanchéité, menuiserie, menuiserie aluminium, métallerie et serrurerie), finitions (plâtrerie et faux plafonds, carrelage et revêtements, peinture), lots techniques (électricité, courants faibles, plomberie, climatisation, sécurité incendie, ascenseurs, solaire), extérieurs et réseaux (VRD, assainissement, forage, aménagements extérieurs). Un corps de métier enregistré avant la mise en place de cette liste reste affiché sous **Autres corps de métier déjà enregistrés** et conservé tant qu'il n'est pas décoché.

::: perm subcontracting:write
- **Nouveau sous-traitant** : **Raison sociale** obligatoire ; nom commercial, corps de métier (cases à cocher par famille), zones, NIU, RCCM, coordonnées, effectif, échéances des assurances RC et décennale, coordonnées bancaires et Mobile Money, **Organisation (accès extranet)** : l'organisation de type « sous-traitant » (Administration › Utilisateurs et rôles › Organisations) dont les comptes ouvriront l'extranet de cette fiche (une organisation ne peut être reliée qu'à une seule fiche).
:::

La fiche présente les onglets **Profil**, **Qualifications**, **Marchés**, **Notations** (blocs **Dossiers de qualification** et **Notations**).

::: perm subcontracting:write
- **Modifier** ouvre **Modifier le sous-traitant** ; **Statut** ouvre **Statut du sous-traitant** (qualifié, suspendu, liste noire, avec motif).
- **Qualifier** ouvre **Qualification** : **Corps de métier** qualifié choisi dans la liste (déjà sélectionné si l'entreprise n'en déclare qu'un ; ceux qu'elle a déclarés sont marqués « déclaré ») — l'approbation exige une assurance décennale valide pour le gros œuvre, la maçonnerie, le ferraillage, le coffrage, la structure, la charpente, la couverture et l'étanchéité, et une approbation ajoute le corps de métier à la fiche ; critères notés de 0 à 5 (références, capacité, sécurité, solidité financière, qualité) avec le score sur 100 calculé en direct (50 minimum pour approuver), références chantier (bouton **Référence** : projet, client, année, montant), **Pièces justificatives** (assurances, attestations, références : déposez les fichiers PDF ou images directement dans la fenêtre, leur nom s'affiche et chaque pièce peut être retirée avant l'enregistrement), décision. Dans **Dossiers de qualification**, chaque pièce jointe s'ouvre d'un clic sur son nom (PDF filigrané au nom du lecteur, consultation tracée dans l'audit).
- **Noter** ouvre **Noter le sous-traitant** en fin de marché (qualité, délais, sécurité, relation).
:::

## Onglet « Consultations »

Les **Consultations** : appels d'offres multi-lots, invitations, offres sous pli scellé jusqu'à la date limite, comparatif, négociation, attribution. Filtre **Statut**.

::: perm subcontracting:write
### Lancer une consultation

1. **Nouvelle consultation** ouvre **Nouvelle consultation** : projet, intitulé, date limite de remise des offres (offres sous pli scellé jusqu'à cette date), description, cahier des charges, exclusions, variantes ; **Pièces du dossier de consultation (DCE)** : cochez les plans et documents GED du projet (version en vigueur) ; **Critères de notation des offres** : pondération prix, délai, valeur technique, historique (total 100 %). Le **Lot 1** est déjà présent ; **Ajouter un lot** en ajoute d'autres, chacun avec ses postes (**Poste** : désignation, unité, quantité). **Retirer le lot** en supprime un.
2. **Créer la consultation** (brouillon). Tant qu'elle est en brouillon, **Modifier** (bloc **Pièces du DCE**) ouvre **Pièces du DCE et critères**.
3. **Inviter** ouvre **Inviter des entreprises** : filtrez au besoin par **Corps de métier**, puis choisissez les sous-traitants qualifiés ; ils reçoivent le dossier (documents filigranés à leur nom) sur leur extranet. Ensuite **Publier** (au moins une entreprise invitée).
4. À la date limite, **Clôturer** ouvre **Clôturer la consultation** : les plis sont ouverts. **Annuler** ouvre **Annuler la consultation** (motif communiqué aux invités).
:::

La fiche consultation présente les blocs **Invitations**, **Offres** et **Lots et bordereaux** ; le **Bordereau comparé (prix unitaires par poste)** compare les offres ligne par ligne.

::: perm subcontracting:award
### Comparer et attribuer

- **Évaluer** ouvre **Évaluation technique — …** (note technique et détail facultatif par critère, bouton **Critère**).
- **Négocier** ouvre **Négociation — …** (contre-proposition demandée) ; si l'entreprise répond, **Accepter** sa contre-proposition.
- **Attribuer** ouvre **Attribuer à …** : le lot est attribué et le marché est créé en brouillon.
:::

## Onglet « Marchés »

Les **Marchés de sous-traitance** : contrat, signature par code, mobilisation, avance, situations, retenue de garantie, clôture. Filtre **Statut**.

::: perm subcontracting:award
- **Marché de gré à gré** (sans consultation) : projet, sous-traitant, titre, **Justification** et éléments du bordereau obligatoires ; lot, retenue de garantie (%), avance forfaitaire et récupération (%), pénalité par jour, TVA, dates, conditions.
- **Envoyer pour signature** (marché en brouillon) : le sous-traitant signe par code depuis son extranet.
:::

La fiche marché présente **Bordereau du marché**, **Situations de travaux**, **Mobilisations** et **Factures du sous-traitant** ; **Contrat PDF** télécharge le contrat.

::: perm subcontracting:write
- **Modifier** ouvre **Modifier le marché** (avant signature).
- **Mobilisation** ouvre **Mobilisation du sous-traitant** (date, effectif, matériel, chantier).
- **Nouvelle situation** ouvre **Nouvelle situation de travaux** (voir [Situations](doc:erp-situations)).
:::

::: perm billing:write
- **Facture d'avance** ouvre **Facture d'avance forfaitaire** (avance prévue au marché).
:::

::: perm finance:approve
- **Libérer la retenue** ouvre **Libération de la retenue de garantie** en fin de garantie.
:::

::: perm subcontracting:award
- **Clôturer** ouvre **Clôturer le marché** (solde, réserves levées) ; **Résilier** ouvre **Résilier le marché** (motif, date d'effet).
:::

## Onglet « Factures »

Les **Factures des sous-traitants** déposées depuis l'extranet. Filtre **Statut**.

::: perm billing:validate
- **Valider (bon à payer)** après contrôle de la situation et des retenues ; **Rejeter** avec motif.
:::

## Onglet « Réclamations »

Les **Réclamations** : demandes de rémunération complémentaire ou contestations des partenaires. Filtre **Statut**.

::: perm disputes:write
- **Nouvelle réclamation** (saisie interne) : titre obligatoire, marché, sous-traitant ou fournisseur, description, montant.
- **Répondre** : décision (accepter, refuser, escalader en litige) et **Réponse** écrite obligatoire.
:::
