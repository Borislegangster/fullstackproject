---
id: erp-assistant
title: Assistant et WhatsApp
space: erp
section: Commercial
order: 30
route: /erp/assistant
perms: [crm:read]
summary: Le guichet 24 h / 24 - l'assistant répond aux prospects et aux clients sur WhatsApp et sur le site (avancement, paiement, reçu) ; vous reprenez la main à tout moment.
keywords: [assistant, chatbot, WhatsApp, conversation, prospect, reprendre la main]
related: [erp-crm, erp-sav]
---

## À quoi sert cet écran

Menu **Commercial › Assistant et WhatsApp**. Onglets **WhatsApp** et **Site web** : toutes les conversations menées par l'assistant. Il qualifie les prospects (un lead CRM est créé : **voir le lead**), répond aux clients identifiés (avancement du chantier, prochain paiement avec lien, envoi du dernier reçu, prise de rendez-vous) et passe la main à un conseiller sur demande (**Conseiller**) ou en cas de doute.

## Ce que sait l'assistant

Quand la clé de l'API Claude est enregistrée (**Paramètres › Intégrations**), l'assistant répond au nom de l'entreprise à partir de **toutes les informations publiées** dans **Site web › Contenus (CMS)** :

- coordonnées, adresse, horaires, mentions légales et réseaux sociaux (**Réglages du site**) ;
- pages publiées ;
- univers, offres (avec leurs indications de prix et de délai), services et expertises ;
- réalisations (avec leurs villes), FAQ, articles d'aide publics et blog ;
- témoignages, équipe, partenaires, certifications, chiffres clés et vidéos.

Les brouillons et les contenus dépubliés n'y figurent jamais. Une modification publiée est prise en compte à la question suivante (au plus tard une minute après).

Si la réponse ne se trouve pas sur le site (question technique, réglementation, démarches au Cameroun…), l'assistant fait une **recherche sur Internet**, recoupe plusieurs sources fiables, puis répond en citant la source. Ce qui est publié sur le site fait toujours foi.

Il n'invente ni prix ni délai : il reprend seulement les indications publiées et renvoie vers **Décrire mon projet** pour un budget. Ses liens mènent uniquement vers les pages du site ou vers l'itinéraire Google publié.

Pour améliorer une réponse, complétez le contenu correspondant dans le CMS, par exemple l'adresse dans les réglages ou une question dans la FAQ.

Sans clé, l'assistant répond avec des réponses types (FAQ, adresse, budget, conseiller).

## Lire une conversation

Cliquez une conversation : historique complet, statut (assistant, conseiller, close), lead ou client associé.

::: perm crm:write
## Répondre sur WhatsApp

1. Saisissez votre message dans **Votre réponse WhatsApp…** et envoyez : en répondant, vous reprenez la main, l'assistant se tait pendant 12 h.
2. **Rendre la main** : l'assistant reprend la conversation.
3. **Clore** la conversation une fois la demande traitée.
:::

> [!NOTE]
> Hors fenêtre de 24 h après le dernier message du contact, WhatsApp n'autorise que des modèles de messages approuvés : l'assistant les utilise automatiquement pour les relances et le time-lapse hebdomadaire.
