---
id: erp-sav
title: SAV et garanties
space: erp
section: Commercial
order: 40
route: /erp/sav
routes: [/erp/sav/*]
perms: [support:read, support:write]
summary: Demandes des clients - réception, affectation, diagnostic sous garantie, intervention planifiée, rapport, validation par le client, coûts et satisfaction.
keywords: [SAV, ticket, garantie, intervention, diagnostic, réclamation client, désordre, satisfaction]
related: [erp-chantier-patrimoine, erp-crm]
---

## Le circuit

Réception → affectation → diagnostic (garantie) → intervention planifiée → résolution → validation par le client. Menu **Commercial › SAV** (écran **SAV et garanties**) ; onglets **Tickets** et **Statistiques**.

## Onglet « Tickets »

Les **Tickets SAV** créés par les clients depuis leur espace, par l'assistant, par le carnet d'entretien ou par l'équipe. Filtres **Statut**, **Catégorie**, **Priorité** ; **Exporter** selon vos droits. Chaque ticket a un délai de réponse et de résolution (politique SLA) : les dépassements sont signalés et escaladés.

::: perm support:write
- **Ticket (appel client)** : enregistrez une demande reçue par téléphone, e-mail ou WhatsApp — **Objet** obligatoire ; projet, catégorie (étanchéité, plomberie, électricité, fissure, menuiserie, peinture, équipement, autre), priorité, description, localisation, zone, **Reçu par**, **Client (organisation)** (par défaut le client du projet : le ticket apparaît dans son espace client) et le demandeur (**Nom**, **E-mail**, **Téléphone du demandeur**). Sans demandeur ni client, le ticket est enregistré comme ticket interne.
:::

## Traiter un ticket

Ouvrez un ticket : informations, **Interventions**, **Échanges** (messages avec le client, visibles dans son espace) et **Photos et documents** ; **← Tickets SAV** revient à la liste.

::: perm support:write
1. **Affecter** ouvre **Affecter le ticket** : technicien ou équipe responsable.
2. **Diagnostic** ouvre **Diagnostic** : cause, gravité, photos.
3. **Décision garantie** ouvre **Décision de garantie** : couvert, non couvert ou partiel (selon les garanties du projet), justification ; le client en est informé.
4. **Planifier une intervention** ouvre **Planifier une intervention** : date, créneau, intervenant ; le client est prévenu.
5. Le jour J, **Démarrer** puis **Terminer** : la fenêtre **Rapport d'intervention** demande le travail réalisé, le temps passé, les fournitures utilisées (bouton **Fourniture** : libellé, quantité, unité, coût), le coût, les photos.
6. **Proposer une réponse (IA)** rédige un brouillon de réponse au client, à relire avant l'envoi.
7. Le client valide l'intervention depuis son espace ; s'il n'est pas satisfait, il peut rouvrir le ticket.
:::

- Écrivez dans **Échanges** puis **Envoyer** ; **Envoyer les fichiers** joint photos et documents.
- **Valider l'intervention** (fenêtre **Valider l'intervention**) et **Rouvrir** (fenêtre **Rouvrir le ticket**) sont normalement faits par le client ; l'équipe peut les enregistrer pour lui sur demande.

## Onglet « Statistiques »

Tickets **Par statut** et **Par catégorie**, délais moyens, respect des SLA, coûts et satisfaction.
