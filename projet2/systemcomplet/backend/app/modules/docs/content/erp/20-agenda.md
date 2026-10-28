---
id: erp-agenda
title: Agenda
space: erp
section: Projets
order: 60
route: /erp/agenda
perms: [agenda:read]
summary: Réunions de chantier, visites client, rendez-vous et visios - avec export vers votre calendrier et visibilité client au cas par cas.
keywords: [agenda, réunion, rendez-vous, visio, calendrier, ics, visite]
related: [erp-appels, erp-planning]
---

## Consulter

Menu **Projets › Agenda**. Vue par semaine ou par mois ; **Aujourd'hui** revient à la date du jour. Cliquez un événement pour voir ses participants, son lieu et son lien de visio.

- **Rejoindre la visio** au moment de la réunion.
- **Ajouter à mon calendrier (.ics)** l'exporte vers Outlook, Google Agenda ou votre téléphone.

::: perm agenda:write
## Planifier un événement

1. **Nouvel événement** (ou double-clic sur un jour) ouvre la fenêtre **Nouvel événement** : titre, type (réunion de chantier, visite client, rendez-vous…), date et heures, lieu ou visio, projet, participants.
2. **Créer l'événement** : les participants sont notifiés.
:::

::: perm projects:publish_client
Pour un événement lié à un projet, cochez **Visible par le client** : il apparaît dans le planning de son espace (réunions et rendez-vous).
:::

## Demandes de rendez-vous des clients

Un client peut proposer un créneau depuis son espace (fenêtre **Demander un rendez-vous**) : le chef de projet, le chargé d'affaires et le conducteur de travaux du projet sont notifiés, et l'événement apparaît **À confirmer**.

::: perm agenda:write
Ouvrez l'événement : **Confirmer le rendez-vous** prévient le client ; pour proposer un autre horaire, **Déplacer** puis confirmez.
:::

## Modifier ou annuler

L'organisateur (et les gestionnaires d'agenda) peut **Enregistrer** des modifications, **Déplacer** l'événement ou **Annuler l'événement** : les participants sont prévenus.
