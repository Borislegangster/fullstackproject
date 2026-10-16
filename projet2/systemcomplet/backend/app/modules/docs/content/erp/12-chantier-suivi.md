---
id: erp-chantier-suivi
title: Fiche projet - suivi du chantier, contenus client et image
space: erp
section: Chantier (fiche projet)
order: 20
routes: [/erp/chantiers/*?onglet=journal, /erp/chantiers/*?onglet=medias, /erp/chantiers/*?onglet=immersion, /erp/chantiers/*?onglet=confiance, /erp/chantiers/*?onglet=panneau, /erp/chantiers/*?onglet=avis, /erp/chantiers/*/journal, /erp/chantiers/*/medias, /erp/chantiers/*/immersion, /erp/chantiers/*/confiance, /erp/chantiers/*/panneau, /erp/chantiers/*/avis]
perms: [projects:read]
summary: Journal de chantier, photos et vidéos publiées au client, time-lapse hebdomadaire et caméras 4G, contenus immersifs et résumés client, indice de confiance et preuves certifiées, panneau de chantier connecté, avis client vérifié.
keywords: [journal, rapport quotidien, photo, vidéo, time-lapse, caméra, 360, drone, digest, résumé, preuve, certificat, panneau, QR, avis, confiance]
related: [erp-chantiers, erp-ia]
---

## Onglet « Journal de chantier »

Le journal regroupe les rapports quotidiens (saisie web, mobile ou rapport vocal IA). Circuit : brouillon → soumis → validé. Filtre **Statut**.

::: perm site:report, projects:write
### Rédiger un rapport

1. **Nouveau rapport** : projet et **Date du journal** (obligatoires), chantier, météo et température, effectifs GLOBUS et sous-traitants, **Travaux réalisés**, **Problèmes rencontrés**, livraisons du jour, visiteurs, notes sécurité, heures de retard, besoins, **Critique**, **Visible par le client**.
2. Ouvrez le rapport puis **Soumettre** pour le transmettre à la validation.
:::

::: perm projects:write
### Valider un rapport

Ouvrez un rapport soumis puis **Valider** : il devient définitif. Un rapport « visible par le client » apparaît dans son suivi de chantier.
:::

## Onglet « Photos et vidéos »

Le bloc **Photos et vidéos de chantier** affiche les médias datés et géolocalisés. Seuls les médias publiés sont visibles du client.

::: perm site:report, projects:write
- **Ajouter** ouvre **Ajouter une photo ou une vidéo** : fichier, légende, étape (avant travaux, pendant les travaux, après travaux, inspection, livraison ou incident), date de prise de vue. Le client peut filtrer sa galerie par étape.
:::

::: perm projects:publish_client
- L'interrupteur **Client** sous chaque média le publie (ou le retire) de l'espace client. Vérifiez qu'aucune photo interne (personnel, plans confidentiels) n'est publiée.
:::

### Time-lapse hebdomadaire

Chaque lundi, une vidéo de la semaine écoulée est générée à partir des caméras 4G ou, à défaut, des photos publiées (jamais des photos internes), puis envoyée au client (espace client et WhatsApp).

::: perm projects:publish_client
- **Générer la semaine écoulée** crée la vidéo sans l'envoyer ; **Générer et envoyer** la transmet aussi au client. **Voir** ouvre la vidéo.
:::

::: perm projects:write
### Caméras 4G du chantier

Chaque caméra dépose ses clichés avec son propre jeton, révocable.

1. **Ajouter une caméra** ouvre **Nouvelle caméra de chantier** : nom et emplacement, puis **Créer**.
2. Copiez le jeton affiché une seule fois et configurez-le dans la caméra (adresse de dépôt indiquée à l'écran).
3. **Désactiver** révoque immédiatement le jeton d'une caméra perdue ou remplacée.
:::

## Onglet « Immersion et digests »

- **Contenus immersifs** : directs, photos et vidéos 360°, vues drone, time-lapse et visites virtuelles publiés au client.
- **Résumés client (digests)** : synthèse hebdomadaire automatique (avancées, risques, dépenses, prochaines décisions) envoyée au client.

::: perm projects:write
- **Nouveau contenu** : type et titre (obligatoires), chantier, description, **Fichier** ou **URL externe**, date de capture, groupe de comparaison (avant / après), zone, **Publié au client**. Le **Fichier** se choisit dans la liste des photos et vidéos du chantier ou des documents du projet (GED), ou se dépose directement (il est alors aussi rangé, non publié, dans les photos et vidéos du chantier) ; pour un direct ou une visite hébergée ailleurs, laissez-le vide et renseignez l'**URL externe**. La modification d'un contenu propose les mêmes choix.
- **Nouveau résumé** : période (début et fin obligatoires), résumé, destinataires (adresses e-mail) ; ou modifiez un résumé généré avant son envoi.
:::

## Onglet « Confiance et preuves »

### Indice de confiance

Note de 0 à 100 calculée chaque jour à partir des données réelles : respect du planning et du budget, contrôles qualité, réactivité SAV et communication. Le client voit le même indice ; une chute brutale déclenche une alerte interne.

### Preuves opposables

Les empreintes SHA-256 des documents publiés, décisions validées, réceptions et photos du jour sont scellées et vérifiables par QR code, par n'importe quel tiers (banque, notaire, assureur), sur la page publique de vérification.

- **Vérifier** recontrôle l'empreinte ; **Certificat** télécharge le certificat avec QR.

::: perm documents:publish, projects:publish_client
- **Certifier les photos du jour** scelle les photos de la journée (preuve d'avancement datée).
:::

::: perm documents:publish
- **Révoquer** une preuve émise par erreur : la fenêtre **Révoquer la preuve** exige un motif ; la preuve reste consultable, marquée révoquée.
:::

## Onglet « Panneau connecté »

Le panneau de chantier porte un QR code menant à une page publique du projet (permis, entreprise, avancement, recrutement local, contact). Indicateurs : statut, **Scans du QR code**, **Visites de la page**, **Messages reçus**.

::: perm projects:write
### Contenu du panneau

Renseignez **Titre affiché**, **Adresse de la page**, **Localisation affichée** (quartier ou ville, jamais l'adresse exacte), **Maître d'ouvrage affiché** (avec l'accord du client), **Entreprise**, **N° du permis de bâtir** et sa date, **Nature des travaux**, les interrupteurs **Avancement**, **Étapes clés**, **Photos**, **Recrutement local** (et **Profils recherchés**), puis **Enregistrer**.
:::

- **Panneau A3 (PDF)** télécharge le panneau à imprimer ; **QR code** télécharge le QR seul.

::: perm projects:publish_client
- **Publier** / **Dépublier** rend la page accessible ou non.
- **Photos publiées sur la page** : sélectionnez jusqu'à 12 photos (recopiées sans métadonnées GPS ni appareil) puis **Publier la sélection**.
:::

### Messages reçus depuis la page

Les demandes de devis deviennent des leads CRM (**Voir le lead**) ; les messages de riverains (bruit, gêne) sont signalés au QHSE.

::: perm projects:write
- **Marquer traité** une fois le message pris en charge.
:::

## Onglet « Avis client »

À la réception, une invitation nominative, liée au chantier, permet au seul client de déposer un avis vérifié ; sa publication sur le site exige son accord.

::: perm crm:write, projects:publish_client
1. Cochez le canal (**E-mail**, **WhatsApp**) puis **Inviter le client**.
2. Sans réponse, **Relancer**.
:::
