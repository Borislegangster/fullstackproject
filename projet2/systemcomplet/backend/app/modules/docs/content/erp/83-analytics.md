---
id: erp-analytics
title: Analytics - audience et conversions du site
space: erp
section: Site web
order: 40
route: /erp/analytics
perms: [analytics:read]
summary: Mesure propriétaire respectueuse du consentement - audience, canaux, conversions (« Décrire mon projet », devis, newsletter), géographie des visiteurs et des prospects (Cameroun / diaspora, continents, pays, régions, villes, carte), pages, recherches internes, qualité technique et blog.
keywords: [analytics, audience, trafic, conversion, campagne, UTM, page, appareil, Core Web Vitals, blog, GA4, pays, ville, région, continent, diaspora, géolocalisation, carte]
related: [erp-cms, erp-seo, erp-crm]
---

## Accès

Menu **Site web › Analytics** : audience de la vitrine, canaux d'acquisition, conversions, contenus. Mesure propriétaire, sans cookie tiers, conforme au consentement des visiteurs. Choisissez la période ; **Actualiser** recharge les chiffres.

## Onglet « Trafic et conversions »

- **Audience et conversions** : sessions, visiteurs, conversions et taux, par canal (direct, recherche, réseaux sociaux, campagnes).
- **Conversions par objectif** : « Décrire mon projet », demandes de devis, inscriptions newsletter, contacts WhatsApp.
- **Pages** les plus vues, **Appareils**, **Navigateurs**.
- **Réseaux sociaux (clics sortants)** et **Recherches internes** (ce que les visiteurs cherchent sur le site : idées de contenus).
- **Qualité technique (p75)** : Core Web Vitals et erreurs remontées par les navigateurs.

## Géographie des visiteurs et des prospects

Même onglet, section **Géographie des visiteurs et des prospects** :

- **Hors Cameroun (diaspora et international)** et **Depuis le Cameroun** : part des visites localisées ;
- **Prospects de la diaspora** : part des demandes de la période venant de l'étranger ;
- **Continents**, **Pays**, **Régions**, **Villes** : visites et conversions de chacun ;
- **Prospects par pays** : demandes reçues (formulaires, assistant, WhatsApp) et demandes qualifiées.

Ces chiffres guident les campagnes et le ciblage. Exemples : pays où lancer une campagne Meta ou Google Ads, villes de la diaspora à cibler, pays qui convertissent le mieux.

La **Carte des visiteurs** place les villes d'origine sur une carte Google : vert pour le Cameroun, orange pour l'étranger. Elle demande la clé Google Maps, avec l'API « Maps Static » activée, enregistrée dans **Paramètres › Intégrations › Google Maps**.

> [!NOTE]
> La localisation est déduite de l'adresse IP sur le serveur, avec la base DB-IP mise à jour chaque mois. Elle ne demande ni clé ni consentement et s'arrête à la ville. L'adresse IP n'est jamais conservée. Les visites antérieures à la mise en service ne peuvent pas être localisées. Un visiteur derrière un VPN apparaît dans le pays du VPN.

## Onglet « Blog »

Lectures, temps de lecture, partages et commentaires par article.

## Onglet « Google Analytics 4 »

GA4 se règle à deux endroits :

- **l'ID de mesure G-…**, dans **Site web › Contenus (CMS) › Réglages du site** : il fait mesurer la vitrine par Google, après l'accord du visiteur pour la mesure d'audience ;
- **l'identifiant de la propriété** (un nombre) et la **clé du compte de service**, dans **Paramètres › Intégrations › Google Analytics 4** : ils affichent ici les chiffres de Google.

Choisissez la dimension (source, campagne, continent, pays, région, ville, appareil, page d'entrée) pour voir les sessions, les événements clés et les utilisateurs. Sans ces réglages, un message indique ce qui manque ; la mesure propriétaire reste disponible.
