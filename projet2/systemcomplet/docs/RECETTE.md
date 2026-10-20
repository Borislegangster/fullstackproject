# Recette complète GLOBUS ENGINEERING V4 — scénario de bout en bout

Objectif : tester **toute** la plateforme avant la livraison au client, comme dans la vraie vie, en suivant **un seul
projet fictif** du premier contact sur le site jusqu'à la garantie : vitrine → CRM → devis → contrat → projet → espace
client → achats → sous-traitance → chantier (application Terrain) → finance → RH / QHSE → SAV → administration et
sécurité.

Chaque étape indique **qui** agit (persona), **où** (menu exact), **quoi faire** (boutons exacts) et **le résultat
attendu**. Cochez la case quand l'étape est conforme ; sinon notez une anomalie (modèle en annexe C) avec le numéro de
l'étape (ex. « F7 »).

> Durée réaliste : 3 à 4 journées pour une personne (ou 2 journées à deux). Faites les phases **dans l'ordre** : chacune
> réutilise ce que la précédente a créé.

---

## Sommaire

- [0. Préparation (à faire une fois)](#0-préparation-à-faire-une-fois)
- [1. Administration : comptes, organisations, équipes](#1-administration--comptes-organisations-équipes)
- [2. Vitrine : le parcours du visiteur](#2-vitrine--le-parcours-du-visiteur)
- [3. CRM : du lead au contrat et au projet](#3-crm--du-lead-au-contrat-et-au-projet)
- [4. Espace client : activation et découverte](#4-espace-client--activation-et-découverte)
- [5. Montage du projet (chef de projet)](#5-montage-du-projet-chef-de-projet)
- [6. Achats, fournisseur (extranet), livraison, stock](#6-achats-fournisseur-extranet-livraison-stock)
- [7. Sous-traitance (extranet) : consultation, marché, situation](#7-sous-traitance-extranet--consultation-marché-situation)
- [8. Chantier au quotidien : application GLOBUS Terrain](#8-chantier-au-quotidien--application-globus-terrain)
- [9. Relation client : publications, décisions, avenants, finances, SAV](#9-relation-client--publications-décisions-avenants-finances-sav)
- [10. Finance et direction](#10-finance-et-direction)
- [11. RH, QHSE, matériel](#11-rh-qhse-matériel)
- [12. Application GLOBUS Direction](#12-application-globus-direction)
- [13. Communication et notifications](#13-communication-et-notifications)
- [14. Site web, marketing, analytics](#14-site-web-marketing-analytics)
- [15. Sécurité et contrôles « négatifs »](#15-sécurité-et-contrôles--négatifs-)
- [16. Clôture de la recette](#16-clôture-de-la-recette)
- [Annexes : limites connues, jeu de données, fiche anomalie, fichiers](#annexe-a--limites-connues-au-20102026)

---

## 0. Préparation (à faire une fois)

### 0.1 Où tester

Production : **https://globus-engineering-sarl.com** (site), **/erp** (personnel), **/espace-client** (clients),
**/extranet** (fournisseurs et sous-traitants), **/connexion** (page de connexion commune).

> [!IMPORTANT]
> La recette crée de vraies données en production (projet, factures numérotées, comptes). Deux options, à choisir
> **avant de commencer** :
> 1. **Garder les données de test** : tout porte le préfixe « TEST » ; à la fin on archive le projet et on désactive
>    les comptes (phase 16). Inconvénient : les numéros (projet PRJ-2026-…, factures) sont consommés.
> 2. **Revenir à l'état d'avant la recette** : sauvegarde complète en 0.5, puis restauration à la fin (phase 16).
>    Tout ce qui est saisi pendant la recette est effacé, **y compris le contenu de la vitrine** : terminez ou mettez en
>    pause la saisie du site avant de commencer.

### 0.2 Adresses e-mail de test (une seule boîte Gmail suffit)

Gmail ignore ce qui suit un « + » : `votre.adresse+client@gmail.com` arrive dans **votre** boîte, mais la plateforme
le considère comme un compte différent. Utilisez :

| Persona | E-mail de test | Rôle(s) à attribuer | Double authentification |
| --- | --- | --- | --- |
| **ADM** — vous, administrateur | votre compte actuel | Administrateur / DG | obligatoire (déjà active) |
| **DIR** — Direction | `votre.adresse+direction@gmail.com` | Direction / Responsable | obligatoire |
| **COM** — Commercial | `votre.adresse+commercial@gmail.com` | Commercial | recommandée |
| **CDP** — Chef de projet | `votre.adresse+chefprojet@gmail.com` | Chef de projet / Conducteur de travaux | recommandée |
| **CDC** — Chef de chantier | `votre.adresse+chantier@gmail.com` | Chef de chantier + Magasinier + Responsable QHSE | recommandée |
| **ACH** — Acheteur | `votre.adresse+achat@gmail.com` | Acheteur / Logistique | recommandée |
| **FIN** — Finance | `votre.adresse+finance@gmail.com` | Finance / Comptabilité + Ressources humaines | obligatoire |
| **TEC** — Technicien SAV | `votre.adresse+technicien@gmail.com` | Artisan / Technicien | recommandée |
| **FOU** — Fournisseur (extranet) | `votre.adresse+fournisseur@gmail.com` | Fournisseur | recommandée |
| **STT** — Sous-traitant (extranet) | `votre.adresse+soustraitant@gmail.com` | Sous-traitant | recommandée |
| **CLI** — Client | `votre.adresse+client@gmail.com` | Client (créé **automatiquement** en phase 3) | obligatoire |

> [!WARNING]
> N'utilisez **jamais** l'adresse d'un compte existant pour le client : la plateforme rattacherait le projet à ce
> compte au lieu d'inviter un nouveau client. Le client ne se crée pas dans « Utilisateurs » : il est invité
> automatiquement à la création du projet depuis le contrat (phase 3).

Pourquoi autant de comptes ? La plateforme applique la **séparation des tâches** : on ne valide jamais ce qu'on a
soi-même créé (demande d'achat, paiement, situation…). Il faut donc au moins deux personnes différentes pour chaque
circuit (ex. FIN crée le paiement, DIR l'approuve).

### 0.3 Matériel

- [ ] **Un ordinateur** avec **un profil de navigateur par persona** (Chrome : avatar en haut à droite › *Ajouter* un
  profil « GLOBUS ADM », « GLOBUS CLI »…). Ainsi chaque persona reste connecté en parallèle. (Les fenêtres de
  navigation privée partagent la même session entre elles : ne les utilisez pas pour deux personas à la fois.)
- [ ] **Une application d'authentification** sur votre téléphone (Google Authenticator ou Microsoft Authenticator) :
  elle contiendra une entrée par compte de test.
- [ ] **Un téléphone Android** (idéalement deux) pour les applications **GLOBUS Terrain**, **GLOBUS Direction** et
  **GLOBUS Client**. Les APK de la dernière version sont dans GitHub › dépôt › *Actions* › dernière exécution
  « GLOBUS V4 — qualité, sécurité, images, déploiement » réussie › section **Artifacts** :
  `globus-terrain-apk-production`, `globus-direction-apk-production`, `globus-client-apk-production` (fichiers ZIP
  contenant `app-release.apk`, conservés 14 jours). Copiez l'APK sur le téléphone et autorisez l'installation
  d'applications de source inconnue.
- [ ] **Les fichiers de test** listés en annexe D (un PDF de plan, des photos, une facture PDF…).
- [ ] Une **imprimante** (ou l'écran d'un second appareil) pour les QR codes (badge, chantier, bon de commande).

### 0.4 Vérifier l'état de la plateforme (ADM)

- [ ] **P1 — Intégrations** · ADM · *Administration › Paramètres › onglet Intégrations*
  - Lire les cartes en haut.
  - ✅ Coche verte : E-mail, Notifications push web, Notifications push mobile, Autodesk APS, Antivirus,
    Reconnaissance vocale. Noter les croix : elles correspondent aux limites de l'annexe A (paiements, WhatsApp, SMS,
    IA si la clé n'est pas renouvelée).
- [ ] **P2 — Système** · ADM · *Paramètres › bouton Système et sauvegardes*
  - ✅ « Événements en échec » = 0, « Dernière sauvegarde » datée de moins de 24 h, tâches planifiées au statut OK.

### 0.5 Sauvegarde de départ (ADM — indispensable si vous choisissez l'option 2)

- [ ] **P3 — Sauvegarde complète** · ADM · *Paramètres › Système et sauvegardes › Sauvegardes*
  - Type **Complète** › **Sauvegarder maintenant** ; attendre qu'elle apparaisse terminée ; **Vérifier**.
  - ✅ Intégrité confirmée (empreinte et signature).
- [ ] **P4 — Test de restauration** · ADM · même écran › **Test de restauration** sur cette sauvegarde.
  - ✅ Restauration réussie dans une base isolée (la production n'est pas touchée). Notez la date/heure de cette
    sauvegarde : c'est votre point de retour.

---

## 1. Administration : comptes, organisations, équipes

But : créer l'entreprise de test du fournisseur et du sous-traitant, les équipes, puis inviter tout le personnel.

- [ ] **A1 — Connexion admin** · ADM · `/connexion`
  - E-mail + mot de passe › **Se connecter** › code à 6 chiffres › **Vérifier**.
  - ✅ Arrivée sur le **Tableau de bord** ; le menu latéral montre toutes les sections (Projets, Achats et logistique,
    Sous-traitance, Finance, Commercial, RH et QHSE, Site web, Communication, Administration, Aide).
- [ ] **A2 — Lire les rôles** · ADM · *Administration › Utilisateurs et rôles › onglet Rôles et permissions*
  - Ouvrir **Voir** sur « Chef de chantier ».
  - ✅ La matrice s'affiche, permissions sensibles signalées. Ne rien modifier.
- [ ] **A3 — Organisation fournisseur** · ADM · *Utilisateurs et rôles › onglet Organisations › Nouvelle organisation*
  - Nom « TEST Quincaillerie du Wouri », type **fournisseur**, ville Douala › enregistrer.
  - ✅ L'organisation apparaît dans la liste (filtre Type = fournisseur).
- [ ] **A4 — Organisation sous-traitant** · ADM · idem
  - Nom « TEST Électricité Akwa », type **sous-traitant** › enregistrer.
  - ✅ Présente dans la liste.
- [ ] **A5 — Fiche fournisseur reliée à l'extranet** · ADM · *Achats et logistique › Fournisseurs › Nouveau fournisseur*
  - Raison sociale « TEST Quincaillerie du Wouri », catégories (ciment, acier), e-mail `+fournisseur`, délai de
    livraison 3 jours, **Organisation** = « TEST Quincaillerie du Wouri » › enregistrer.
  - ✅ La fiche s'ouvre (onglets Profil, Catalogue et tarifs, Commandes, Documents, Performance, Incidents, Contacts).
- [ ] **A6 — Catalogue fournisseur** · ADM · fiche fournisseur › onglet **Catalogue et tarifs** › **Nouveau produit**
  - Référence « CIM-425 », nom « Ciment CPJ 42.5 sac 50 kg », unité sac, prix unitaire 5 200 XAF, prix valable
    jusqu'au +3 mois.
  - ✅ Produit listé.
- [ ] **A7 — Fiche sous-traitant reliée à l'extranet** · ADM · *Sous-traitance › Sous-traitants › Nouveau sous-traitant*
  - Raison sociale « TEST Électricité Akwa », corps de métier **électricité** (lots techniques), assurance RC à une
    date future, e-mail `+soustraitant`, **Organisation** = « TEST Électricité Akwa ».
  - ✅ Fiche créée, statut « en qualification ».
- [ ] **A8 — Équipe** · ADM · *Utilisateurs et rôles › onglet Équipes › Nouvelle équipe*
  - Nom « TEST Équipe gros œuvre », métier maçonnerie (le chef d'équipe sera choisi après A10).
  - ✅ Équipe listée.
- [ ] **A9 — Inviter le personnel** · ADM · *Utilisateurs et rôles › onglet Utilisateurs › Nouvel utilisateur*
  - Pour **chaque** persona DIR, COM, CDP, CDC, ACH, FIN, TEC : e-mail (tableau 0.2), prénom, nom « TEST »,
    **Rôles** du tableau, métier si pertinent (CDC : « Chef de chantier »), laisser **Envoyer l'invitation** cochée,
    canal **E-mail** › enregistrer.
  - ✅ Chaque compte apparaît (statut « invité ») ; l'onglet **Invitations** liste 7 invitations « en attente ».
- [ ] **A10 — Inviter les partenaires** · ADM · idem
  - FOU : rôle **Fournisseur**, organisation « TEST Quincaillerie du Wouri ».
  - STT : rôle **Sous-traitant**, organisation « TEST Électricité Akwa ».
  - ✅ 2 invitations supplémentaires en attente.
- [ ] **A11 — Révoquer une invitation** · ADM · onglet **Invitations**
  - Créer une invitation volontairement fausse (`+erreur`) puis **Révoquer**.
  - ✅ Statut « révoquée » ; le lien reçu par e-mail ne fonctionne plus (« lien invalide ou expiré »).
- [ ] **A12 — Activation de chaque compte** · chaque persona, dans **son** profil de navigateur
  - Ouvrir l'e-mail d'invitation (vérifier aussi le dossier Spam) › lien › vérifier nom/prénom › mot de passe de
    12 caractères minimum › **Activer et continuer**.
  - Pour DIR et FIN (obligatoire) — et idéalement pour tous : *Mon compte › Sécurité ›* **Configurer une application
    d'authentification** › scanner le QR › saisir le code › **Activer** › **Télécharger** les codes de secours ›
    **J'ai conservé mes codes**.
  - ✅ Chaque persona arrive dans le bon espace : personnel → `/erp` (menu réduit à son rôle), FOU/STT → `/extranet`.
    Le bandeau rouge « La double authentification est obligatoire » disparaît après activation.
  - ✅ Côté ADM, *Administration › Sécurité › Synthèse* : « MFA à activer » ne liste plus DIR ni FIN.
- [ ] **A13 — Compléter l'équipe** · ADM · onglet **Équipes** › ouvrir « TEST Équipe gros œuvre » › **Modifier**
  - Chef d'équipe = CDC, membres = CDC, TEC.
  - ✅ La fiche affiche les membres par leur nom.

---

## 2. Vitrine : le parcours du visiteur

But : vérifier que le site convertit un visiteur en prospect. Faites-le **sur téléphone ET sur ordinateur**, sans être
connecté (profil de navigateur « Visiteur » ou navigation privée).

- [ ] **V1 — Bandeau cookies** · Visiteur · page d'accueil
  - Cliquer **Personnaliser**, refuser la mesure d'audience, enregistrer ; recharger.
  - ✅ Le bandeau ne revient pas ; *Gérer les cookies* (pied de page) le rouvre.
- [ ] **V2 — Navigation** · Visiteur
  - Ouvrir chaque entrée du menu (et des sous-menus), le menu mobile (☰), les boutons d'action de l'en-tête, les
    liens du pied de page (principal, services, légal).
  - ✅ Aucune page « introuvable », aucune image cassée, textes en français, mise en page correcte sur téléphone.
- [ ] **V3 — Recherche** · Visiteur · icône loupe
  - Chercher « villa », puis « devis ».
  - ✅ Résultats pertinents (pages, offres, articles, FAQ), mots surlignés.
- [ ] **V4 — Contenus dynamiques** · Visiteur
  - Ouvrir une offre, une expertise, un service, une réalisation, un article de blog, la FAQ, le centre d'aide.
  - ✅ Les pages s'affichent avec leurs images ; les « mis en avant » apparaissent sur l'accueil.
- [ ] **V5 — Décrire mon projet** · Visiteur · bouton **Décrire mon projet**
  - Étape **Votre univers** (ex. HOME) › **Continuer** › **Votre projet** (type maison, surface 180 m², 2 niveaux,
    terrain : oui, ville Douala) › **Budget et délai** (budget 20 000 000 – 30 000 000 XAF, délai 3 mois, financement
    fonds propres) › **Vos coordonnées** : prénom « Paul », nom « TEST-MBALLA », e-mail
    `votre.adresse+client@gmail.com`, téléphone, contact préféré **email**, cocher le consentement › **Envoyer ma
    demande**.
  - ✅ Message de confirmation avec un numéro de demande ; e-mail d'accusé de réception reçu sur l'adresse `+client`.
- [ ] **V6 — Estimation instantanée** · Visiteur · page *Estimation instantanée*
  - Déposer une photo de terrain ou un croquis, décrire le projet, coordonnées (`+client`), consentement › envoyer.
  - ✅ Demande enregistrée. (L'analyse automatique dépend de la clé IA — voir annexe A.)
- [ ] **V7 — Formulaire de contact** · Visiteur · page *Contact*
  - Remplir avec `votre.adresse+contact@gmail.com` › envoyer.
  - ✅ Message de succès + accusé de réception par e-mail.
- [ ] **V8 — Newsletter (double opt-in)** · Visiteur · pied de page › *Newsletter*
  - Saisir `votre.adresse+news@gmail.com`, cocher l'accord › **S'inscrire** ; ouvrir l'e-mail de confirmation et
    cliquer le lien.
  - ✅ Inscription confirmée (statut « confirmé » visible en phase 14).
- [ ] **V9 — Assistant du site** · Visiteur · bulle en bas à droite
  - Poser « Combien coûte une villa de 150 m² ? », puis laisser ses coordonnées si proposé.
  - ✅ Réponse cohérente (mode règles si l'IA n'est pas active) ; la conversation apparaît dans *Commercial ›
    Assistant et WhatsApp* (phase 3).
- [ ] **V10 — Commentaire de blog** · Visiteur · un article › formulaire de commentaire
  - Nom, e-mail, commentaire › envoyer.
  - ✅ « Votre commentaire sera publié après modération » (modération en phase 14).
- [ ] **V11 — Pages légales et vérification** · Visiteur
  - Ouvrir mentions légales, confidentialité, cookies, CGU.
  - ✅ Contenu présent, à jour avec les coordonnées de l'entreprise.

---

## 3. CRM : du lead au contrat et au projet

But : transformer la demande « Paul TEST-MBALLA » en projet signé, ce qui **crée automatiquement l'espace client**.

- [ ] **C1 — Réglages SLA et affectation** · ADM · *Commercial › CRM › onglet Réglages*
  - **Nouvelle règle** d'affectation : nom « TEST Douala », critère ville Douala, commercial = COM, stratégie tour de
    rôle.
  - ✅ Règle active (les prochains leads de Douala iront à COM).
- [ ] **C2 — Le lead est arrivé** · COM · *CRM › onglet Leads*
  - ✅ Les demandes V5, V6 (et V7 si le formulaire crée un lead) apparaissent avec source, univers, score, température
    et le chronomètre du délai de première réponse ; COM a reçu une notification (cloche).
- [ ] **C3 — Fiche lead** · COM · ouvrir le lead de V5
  - ✅ Bloc **Dossier « Décrire mon projet »** complet (réponses, taux de complétude), score expliqué.
- [ ] **C4 — Première activité** · COM · fiche lead › **Activité**
  - Type appel, compte rendu « Premier échange, RDV terrain », relance dans 2 jours › enregistrer.
  - ✅ Le chronomètre SLA s'arrête ; statut passe à « contacté ».
- [ ] **C5 — Qualifier** · COM · **Qualifier**
  - Besoin, budget 25 000 000, délai 3 mois, décisionnaire : oui › enregistrer.
  - ✅ Statut « qualifié ».
- [ ] **C6 — Convertir** · COM · **Convertir en opportunité**
  - Montant estimé 25 000 000 XAF, étape, date de décision dans 15 jours › valider › **Voir le pipeline**.
  - ✅ Carte visible dans l'onglet **Pipeline** ; un contact « Paul TEST-MBALLA » et une organisation client sont
    créés (onglet **Contacts**).
- [ ] **C7 — Faire avancer le pipeline** · COM · onglet **Pipeline**
  - Glisser la carte d'une étape à la suivante.
  - ✅ L'étape change et reste après rechargement.
- [ ] **C8 — Créer le devis** · COM · carte d'opportunité › **Devis**
  - Lignes : « Études et plans » 1 × 3 000 000 ; « Gros œuvre » 1 × 15 000 000 ; « Second œuvre » 1 × 7 000 000 ;
    TVA 19,25 % ; **Échéance** : 30 % signature, 40 % mi-chantier, 30 % réception ; validité 30 jours › enregistrer.
  - ✅ Totaux HT / TVA / TTC corrects ; **PDF** lisible et à l'image de l'entreprise.
- [ ] **C9 — Envoyer le devis** · COM · devis › **Envoyer**
  - ✅ Statut « envoyé » ; e-mail reçu sur `+client` avec un lien sécurisé.
- [ ] **C10 — Le client accepte le devis** · CLI (sans compte) · lien de l'e-mail
  - Lire le devis › saisir **Nom et prénom du signataire** › cocher « J'ai lu le devis et j'accepte ses conditions. »
    › **Recevoir mon code** (par e-mail) › saisir le **Code reçu** › **Accepter ce devis**.
  - ✅ « Devis accepté » ; côté COM le devis passe « accepté » avec la preuve (horodatage, canal du code) ; COM est
    notifié.
- [ ] **C11 — Révision (contrôle)** · COM · sur un **second** devis brouillon de test › **Réviser**
  - ✅ Nouvelle révision créée, l'ancienne reste consultable. Enregistrer ensuite un **Refus client** sur ce second
    devis (motif « prix ») : statut « refusé ».
- [ ] **C12 — Établir le contrat** · ADM (ou COM si droit contrats) · devis accepté › **Établir le contrat**
  - Conditions, échéancier contractuel repris du devis › valider.
  - ✅ Contrat visible dans l'onglet **Contrats** avec son **Échéancier contractuel**.
- [ ] **C13 — Signature du contrat** · ADM · contrat › **Contrat signé**
  - Date du jour, mode « signature manuscrite scannée », joindre un PDF › **Enregistrer la signature**.
  - ✅ Statut « signé ».
- [ ] **C14 — Créer le projet** · ADM · contrat › **Créer le projet**
  - Nom « TEST — Villa Mballa », responsable = CDP › valider › **Projet**.
  - ✅ Projet créé (code PRJ-AAAA-NNNNN), avec : budget initial par lot, **jalons** issus de l'échéancier, CDP membre.
  - ✅ **Le client reçoit un e-mail d'invitation** à son espace sur `+client`.
- [ ] **C15 — Activités et relances** · COM · onglet **Activités**
  - ✅ La relance planifiée en C4 apparaît ; **Marquer faite** la clôt.
- [ ] **C16 — Assistant** · COM · *Commercial › Assistant et WhatsApp*
  - ✅ La conversation de V9 est lisible ; **Clore** la termine.

---

## 4. Espace client : activation et découverte

- [ ] **K1 — Activation** · CLI · e-mail d'invitation (profil navigateur « GLOBUS CLI »)
  - Lien › vérifier nom/prénom › mot de passe (12 car.) › **Activer et continuer**.
  - ✅ Arrivée sur l'espace client ; la double authentification est demandée.
- [ ] **K2 — Double authentification client** · CLI · *Mon compte › Sécurité*
  - **Configurer une application d'authentification** › QR › code › **Activer** › codes de secours conservés.
  - ✅ Le reste de l'espace devient accessible.
- [ ] **K3 — Reconnexion** · CLI · se déconnecter (avatar) puis se reconnecter avec le code.
  - ✅ Connexion OK ; avec **Rester connecté**, l'appareil devient « de confiance ».
- [ ] **K4 — Tableau de bord** · CLI · *Tableau de bord*
  - ✅ Référence et nom du projet, montant du contrat (25 M + TVA), jalons (frise), aucun montant payé, pas de données
    d'un autre client.
- [ ] **K5 — Tour des menus** · CLI · ouvrir chaque menu : Passeport projet, Chantier, Planning, Finances, Documents,
  Preuves certifiées, Validations, Immersion (maquette 3D, configurateur, live), Messagerie, Appels, Mon bâtiment,
  Énergie, SAV, Dossier Tranquillité, Mon avis, Notifications, Mon compte.
  - ✅ Chaque page s'ouvre avec un état vide explicite (« Aucune image publiée », « Aucun document publié »…) et
    aucune erreur. **Financement** et **Parrainage** n'apparaissent pas tant qu'ils ne sont pas ouverts (phase 9).
- [ ] **K6 — Application GLOBUS Client** · CLI · téléphone
  - Installer l'APK client › se connecter (e-mail, mot de passe, code) › parcourir Accueil, Chantier, Finances,
    Messages, Plus.
  - ✅ Mêmes données que sur le web ; *Mon compte › Notifications › Activer le push* puis **Envoyer une notification
    de test** : notification reçue sur le téléphone.

---

## 5. Montage du projet (chef de projet)

Tout se passe dans *Projets › Chantiers* › « TEST — Villa Mballa » (persona **CDP**).

- [ ] **M1 — Synthèse et modification** · CDP · onglet **Synthèse** › **Modifier**
  - Compléter adresse, ville Douala, coordonnées GPS (latitude/longitude du chantier), surface 180, 2 niveaux, univers,
    **Visible par le client** coché › enregistrer.
  - ✅ Informations à jour ; indicateurs budget / engagé / facturé affichés.
- [ ] **M2 — Équipe projet** · CDP · onglet **Équipe** › **Ajouter un membre**
  - CDC (rôle chef de chantier), TEC (technicien), ACH (acheteur), FIN (accès finances coché).
  - ✅ Membres listés ; chacun voit désormais le projet dans sa liste (vérifier avec CDC).
- [ ] **M3 — Site (chantier) avec géorepérage** · CDP · onglet **Sites, phases, lots** › **Nouveau site**
  - Code « S1 », nom « Parcelle Bonamoussadi », coordonnées GPS, **Rayon de géorepérage (m)** 150, chef de chantier
    CDC.
  - ✅ Site créé (indispensable au pointage par QR en phase 8).
- [ ] **M4 — Lots et phases** · CDP · même onglet
  - Vérifier les lots créés depuis le devis ; **Nouveau lot** « LOT-ELEC Électricité » (discipline électricité,
    budget 2 000 000) ; **Nouvelle phase** « Fondations » (visible client) et « Élévation ».
  - ✅ Structure visible.
- [ ] **M5 — Jalons** · CDP · onglet **Jalons**
  - ✅ Les 3 jalons du contrat existent avec leur **Part de paiement (%)** (30/40/30). Ajouter **Nouveau jalon**
    « Implantation » (visible client, sans paiement).
- [ ] **M6 — Tâches et planning** · CDP · onglet **Planning**
  - **Nouvelle tâche** ×4 : « Implantation », « Terrassement », « Fondations », « Élévation murs » (dates, durées,
    lot, **Visible par le client** pour 2 d'entre elles). Dans le **Diagramme de Gantt** : **Dépendance** fin-début
    entre chaque tâche › **Ordonnancer (CPM)** › **Figer une référence** « Contrat ».
  - ✅ Gantt cohérent, chemin critique en rouge, référence listée dans **Références de planning (baselines)**.
- [ ] **M7 — Planning intelligent** · CDP · bloc *Planning intelligent* › **Analyser maintenant**
  - ✅ Analyse exécutée (risques listés ou « aucun risque ») ; si un risque apparaît : **Écarter** avec un motif.
- [ ] **M8 — Budget** · FIN · onglet **Budget**
  - Vérifier la version « Budget initial (contrat) » ; **Nouvelle version** si besoin ; puis DIR › **Approuver**.
  - ✅ Version approuvée = référence des marges. (FIN ne peut pas approuver une version qu'il a créée lui-même si la
    règle s'applique : c'est normal.)
- [ ] **M9 — GED : déposer et publier un plan** · CDP · *Projets › GED* › **Déposer un document**
  - Projet TEST, type plan, discipline architecture, titre « Plan RDC », confidentialité normale, fichier PDF ›
    **Déposer** › dans la fiche : passer **En revue** avec une étape (approbateur DIR) › DIR **Valider** › CDP
    **Publier**.
  - ✅ Version « bon pour exécution » ; **Nouvelle version** puis publication : l'ancienne devient obsolète.
- [ ] **M10 — Publier au client** · CDP · fiche du document › **Propriétés** › cocher la visibilité **client** ›
  enregistrer
  - ✅ CLI voit « Plan RDC » dans **Documents** ; **Ouvrir** donne une copie filigranée à son nom ; **Authenticité**
    confirme le document.
- [ ] **M11 — Hub BIM** (si vous avez un fichier IFC/RVT) · CDP · *Projets › Hub BIM* › onglet **Maquettes** ›
  **Nouvelle maquette** › **Nouvelle version** (déposer le fichier) › attendre « prête » › **Valider** › **Publier**.
  - ✅ La maquette fédérée s'affiche ; créer une issue localisée depuis la maquette ; CLI voit la maquette dans
    *Immersion*. Sans fichier : passer l'étape et la noter « non testée ».
- [ ] **M12 — Zones et QR** · CDP · Hub BIM › onglet **Zones** › **Nouvelle zone** « Séjour RDC » › **QR de la zone** ›
  **Imprimer**.
  - ✅ QR imprimé (utilisé en phase 8).
- [ ] **M13 — Agenda** · CDP · *Projets › Agenda* › **Nouvel événement**
  - « Réunion de lancement », type visite client, demain 10 h, projet TEST, participants CLI, CDC, visio cochée ›
    **Créer l'événement**.
  - ✅ CLI et CDC notifiés ; l'événement apparaît dans *Planning* de l'espace client ; **Ajouter à mon calendrier
    (.ics)** fonctionne.
- [ ] **M14 — Risques** · CDP · onglet **Risques** › **Nouveau risque** « Saison des pluies » (probabilité, impact,
  exposition financière 500 000).
  - ✅ Risque listé.
- [ ] **M15 — Panneau de chantier** · CDP · onglet **Panneau connecté**
  - Renseigner titre, localisation (quartier), entreprise, n° de permis, activer Avancement et Photos › **Enregistrer** ›
    **Publier** › **Panneau A3 (PDF)**.
  - ✅ PDF avec QR ; scanner le QR avec un téléphone ouvre la page publique du chantier.

---

## 6. Achats, fournisseur (extranet), livraison, stock

- [ ] **H1 — Dépôt et article** · CDC (magasinier) · *Achats et logistique › Stocks › onglet Articles, dépôts,
  emplacements*
  - **Nouveau dépôt** « DEP-S1 » (type chantier, projet TEST) ; **Nouvel article** « CIM-425 Ciment CPJ 42.5 »
    (unité sac, **Seuil d'alerte** 20).
  - ✅ Article et dépôt listés.
- [ ] **H2 — Demande d'achat** · CDC · *Achats › onglet Demandes d'achat › Nouvelle demande*
  - Projet TEST, ligne : article ciment, 100 sacs, prix estimé 5 200 ; urgence normale ; **Besoin pour le** dans
    5 jours ; cocher **Soumettre immédiatement**.
  - ✅ Statut « soumise » ; l'approbateur est notifié.
- [ ] **H3 — Approbation** · DIR · *Achats › onglet Mes approbations*
  - Ouvrir la demande › vérifier le **Circuit d'approbation** › **Approuver** › **Confirmer**.
  - ✅ Statut « approuvée ». (Contrôle : CDC ne voit pas de bouton pour approuver sa propre demande.)
- [ ] **H4 — Choix du fournisseur et commande** · ACH · demande approuvée › bloc **Choix du fournisseur** › **Classer
  les fournisseurs** › **Commander** sur « TEST Quincaillerie du Wouri » › vérifier › **Créer le bon de commande**.
  - ✅ BC créé (onglet **Bons de commande**) ; **PDF** correct ; bouton **QR réception** disponible (imprimez-le).
- [ ] **H5 — Envoi au fournisseur** · ACH · BC › **Envoyer au fournisseur**
  - Canal **e-mail**, message › **Envoyer**.
  - ✅ Statut « envoyée » ; e-mail reçu sur `+fournisseur`.
- [ ] **H6 — Le fournisseur confirme** · FOU · *Extranet › Fournitures › Commandes* › ouvrir le BC
  - ✅ Il ne voit que ses commandes (aucun prix d'autres fournisseurs).
  - **Confirmer la commande** (votre nom, commentaire) ; *ou* tester d'abord **Proposer une contre-offre** (prix
    5 000) puis ACH **Accepter la contre-offre**.
  - ✅ Statut « confirmée » côté ACH.
- [ ] **H7 — Annonce d'expédition** · FOU · BC › **Annoncer une expédition**
  - Arrivée estimée demain, transporteur, n° de bon de livraison, chauffeur › **Annoncer**.
  - ✅ La livraison apparaît dans *Achats et logistique › Livraisons* et dans *Fournitures › Livraisons* (FOU) ; CDC
    est prévenu.
- [ ] **H8 — Réception sur chantier (application Terrain)** · CDC · téléphone, application **GLOBUS Terrain** ›
  **Scanner** › QR réception du BC (imprimé en H4)
  - Saisir 98 reçus, 2 refusés (motif « sacs percés »), photo + bon de livraison › **Valider la réception**.
  - ✅ Réception validée ; un incident fournisseur est créé pour l'écart ; le stock du dépôt augmente de 98.
    (Alternative web : *Livraisons › onglet Réceptions › Nouvelle réception*.)
- [ ] **H9 — Stock** · CDC · *Stocks › onglet État du stock*
  - ✅ 98 sacs dans DEP-S1, valeur au CMUP ; *Mouvements* montre l'entrée.
  - **Affectations chantier** › **Réserver pour un chantier** 30 sacs › **Sortir** 30 › **Consommé** 25 › **Retour** 5.
  - ✅ Coût de 25 sacs imputé au projet (onglet Budget › Dépenses).
- [ ] **H10 — Facture fournisseur (extranet)** · FOU · BC › **Déposer une facture**
  - N° « FAC-TEST-001 », date, échéance, TVA, quantités pré-remplies (98), fichier PDF › **Déposer la facture**.
  - ✅ La facture apparaît dans *Facturation › Factures* de l'extranet avec le **Contrôle** « Conforme ».
- [ ] **H11 — Rapprochement 3 pièces** · FIN · *Finance › Facturation › onglet Factures fournisseurs* › ouvrir la facture
  - **Rapprocher** › ✅ commande / réception / facture concordent › **Valider (bon à payer)**.
  - Contrôle : saisir une seconde facture avec un prix supérieur ⇒ elle part dans **Anomalies 3 pièces** ; DIR
    **Arbitrer** (rejeter).
- [ ] **H12 — Ordre de paiement** · FIN · facture bon à payer › **Payer** (ou *Finances › Paiements › Ordre de paiement*)
  - Montant, mode virement, date › **Créer l'ordre de paiement**.
  - ✅ Statut « à approuver ».
- [ ] **H13 — Double regard** · FIN puis DIR
  - FIN tente **Approuver** son propre ordre : ✅ refusé (« une seconde personne est requise »).
  - DIR · *Finances › Paiements* › ouvrir › **Approuver**.
  - ✅ Statut « approuvé ».
- [ ] **H14 — Exécution** · FIN · paiement approuvé › **Exécuter**
  - Mode **Virement / Mobile Money effectué hors plateforme (preuve jointe)**, **Référence bancaire / Mobile Money**
    « VIR-TEST-0001 », joindre une preuve PDF › **Confirmer l'exécution**.
  - ✅ Statut « payé » ; FOU voit le règlement dans *Facturation › Paiements* ; la facture est « payée ».
- [ ] **H15 — Noter et clôturer** · ACH · BC › **Noter le fournisseur** (qualité 4/5…) › **Clôturer**.
  - ✅ BC clôturé ; la note apparaît dans la **Performance** du fournisseur et dans *Fournitures › Performance* (FOU).
- [ ] **H16 — Documents légaux fournisseur** · FOU · *Fournitures › Documents › Déposer un document*
  - Attestation fiscale, date de validité, fichier › **Déposer** ; ACH › fiche fournisseur › **Marquer vérifié**.
  - ✅ Statut « vérifié par GLOBUS » côté extranet.

---

## 7. Sous-traitance (extranet) : consultation, marché, situation

- [ ] **S1 — Qualification** · CDP · *Sous-traitance › Sous-traitants* › « TEST Électricité Akwa » › **Qualifier**
  - Corps de métier électricité, notes 4/5 sur chaque critère, une référence, une pièce PDF, décision « approuver ».
  - ✅ Score ≥ 50, statut « qualifié ».
- [ ] **S2 — Consultation** · CDP · onglet **Consultations** › **Nouvelle consultation**
  - Projet TEST, titre « Lot électricité », date limite dans **10 minutes** (pour pouvoir clôturer pendant la recette),
    pli scellé, un document ; **Ajouter un lot** avec 2 postes (« Tableau électrique » 1 u ; « Points lumineux »
    30 u) › **Créer la consultation** › **Publier** › **Inviter** › choisir « TEST Électricité Akwa ».
  - ✅ STT notifié.
- [ ] **S3 — Offre du sous-traitant** · STT · *Extranet › Sous-traitance › Consultations* › ouvrir
  - Lot › **Remettre une offre** › prix unitaires (350 000 ; 25 000), délai 20 jours, mémoire technique PDF ›
    **Déposer l'offre**.
  - ✅ « Offre déposée » ; côté CDP, l'offre reste **scellée** (montant invisible) avant la date limite.
- [ ] **S4 — Clôture et attribution** · CDP (ou DIR) · après la date limite › **Clôturer** › **Bordereau comparé** ›
  **Évaluer** (note technique) › **Négocier** (contre-proposition) › STT **Accepter …** ou **Contre-proposer** ›
  **Attribuer**.
  - ✅ Marché créé en brouillon (onglet **Marchés**).
- [ ] **S5 — Signature électronique du marché** · DIR/CDP › **Envoyer pour signature** ; STT · *Mes marchés* ›
  **Contrat PDF** › **Signer le marché** › nom et qualité › case d'acceptation › **Recevoir mon code** › code ›
  **Signer**.
  - ✅ Marché « en cours », signature horodatée.
- [ ] **S6 — Mobilisation** · CDP · marché › **Mobilisation** (date, effectif 4, chantier S1).
  - ✅ Mobilisation listée.
- [ ] **S7 — Situation de travaux** · STT · *Mes marchés* › **Nouvelle situation**
  - Période du mois, réalisé : tableau 1, points lumineux 10 › **Créer la situation** › ouvrir › **Envoyer les photos**
    (2 photos) › **Soumettre**.
  - ✅ Statut « soumise ». Contrôle : sans photo, la soumission est refusée.
- [ ] **S8 — Constat terrain** · CDC · *Sous-traitance › Situations* › situation › **Constat terrain**
  - Quantités constatées (points lumineux 9), observation, photo › **Enregistrer le constat**.
  - ✅ Statut « contrôlée sur le terrain » ; STT voit « Constaté » = 9.
- [ ] **S9 — Validation** · DIR · **Valider** (montants, retenue de garantie, récupération d'avance calculés).
  - ✅ Statut « validée ».
- [ ] **S10 — Facture de situation** · STT · situation validée › **Déposer la facture** (n°, date, montant TTC, PDF) ›
  **Déposer** ; FIN · *Sous-traitance › onglet Factures* › **Valider (bon à payer)** › paiement comme H12 → H14.
  - ✅ STT voit la facture « payée » et le paiement dans *Facturation › Paiements*.
- [ ] **S11 — Réclamation** · STT · *Sous-traitance › Réclamations › Nouvelle réclamation* (marché, objet, exposé,
  montant 150 000) › **Déposer** ; CDP · *Sous-traitants › onglet Réclamations* › **Répondre** (refuser, réponse écrite).
  - ✅ STT voit la réponse.
- [ ] **S12 — Litige** · STT · *Litiges › Ouvrir un litige* (marché, situation, exposé, montant contesté 25 000,
  pièce) › **Ouvrir le litige** ; DIR · *Sous-traitance › Litiges* › **Faire évoluer** › **Ajouter à la chronologie** ›
  **Décision** › **Clore (résolu)**.
  - ✅ Montant gelé pendant le litige puis libéré ; chronologie non modifiable des deux côtés.
- [ ] **S13 — Dépassement de marché** · STT · nouvelle situation avec des quantités supérieures au marché › DIR ›
  ✅ validation bloquée ; **Accorder une dérogation** (justification) débloque.

---

## 8. Chantier au quotidien : application GLOBUS Terrain

Téléphone de **CDC** (et de TEC pour le SAV). Pour les tests de pointage, être physiquement dans le rayon du site (ou
mettre temporairement les coordonnées du site sur votre position en M3).

- [ ] **T1 — Connexion** · CDC · application Terrain › e-mail, mot de passe, code
  - ✅ Le **chantier courant** « TEST — Villa Mballa » s'affiche ; seules les rubriques de ses rôles apparaissent.
- [ ] **T2 — Mes tâches** · CDC · **Mes tâches** › « Implantation » › avancement 100 % + photo.
  - ✅ L'avancement du projet est recalculé côté ERP et côté client.
- [ ] **T3 — Journal de chantier** · CDC · **Journal de chantier** › rapport du jour (météo, effectifs 6, travaux,
  **Visible par le client**) › soumettre ; CDP · ERP › onglet **Journal de chantier** › **Valider**.
  - ✅ CLI voit le rapport dans **Chantier**.
- [ ] **T4 — Photos** · CDC · **Photos et vidéos** › 3 photos (étape « pendant les travaux », légende).
  - ✅ Photos visibles dans l'ERP (onglet **Photos et vidéos**) avec position GPS ; pas encore chez le client tant que
    l'interrupteur **Client** n'est pas activé (phase 9).
- [ ] **T5 — Rapport vocal** · CDC · **Rapports vocaux** › dicter 30 secondes › valider le texte proposé.
  - ✅ Transcription française correcte (reconnaissance vocale hébergée sur le serveur).
- [ ] **T6 — Scanner une zone** · CDC · **Scanner** › QR de la zone (M12)
  - ✅ Ouvre plans autorisés, tâches et photos de la zone ; **seule la version publiée** du plan est proposée.
- [ ] **T7 — Plan périmé** · CDP · publier une nouvelle version de « Plan RDC » (M9) ; CDC rouvre le plan téléchargé.
  - ✅ Bandeau rouge **Plan périmé**.
- [ ] **T8 — Incident QHSE** · CDC · **QHSE › Signaler** (chute de matériel, gravité moyenne, 2 photos).
  - ✅ Incident visible dans *RH et QHSE › QHSE › Incidents* ; le responsable QHSE est notifié.
- [ ] **T9 — Mode hors ligne** · CDC · activer le **mode avion** › saisir : avancement d'une tâche, un journal, une
  photo, un incident › désactiver le mode avion.
  - ✅ Pendant la coupure : bandeau hors ligne, saisies conservées ; au retour : envoi automatique (≤ 2 min ou en
    tirant l'écran vers le bas), **aucun doublon** côté ERP.
- [ ] **T10 — Conflit de synchronisation** · CDC (hors ligne) modifie l'avancement d'une tâche ; pendant ce temps CDP
  modifie la même tâche dans l'ERP ; CDC repasse en ligne.
  - ✅ La saisie passe en conflit ; **Synchronisation** › comparer « Bureau » / « Moi » › **Fusionner** ; arbitrage
    tracé dans le journal d'audit.
- [ ] **T11 — Stock chantier** · CDC · **Stock chantier** › sortie de 5 sacs vers le chantier (même hors ligne).
  - ✅ Mouvement visible dans *Stocks › Mouvements*.
- [ ] **T12 — Lecture de document (IA)** · CDC · **Lecture de documents** › photographier un bon de livraison.
  - ✅ Données proposées, jamais appliquées sans validation (dépend de la clé IA — annexe A).

---

## 9. Relation client : publications, décisions, avenants, finances, SAV

- [ ] **R1 — Publier des photos** · CDP · onglet **Photos et vidéos** › interrupteur **Client** sur 2 photos.
  - ✅ CLI les voit dans **Chantier** (filtre par étape) et sur l'accueil (« Dernières images »).
- [ ] **R2 — Certifier les photos du jour** · CDP · onglet **Confiance et preuves** › **Certifier les photos du jour**.
  - ✅ Preuve créée ; **Certificat** télécharge un PDF avec QR ; CLI la voit dans **Preuves certifiées** et
    **Vérifier un fichier** confirme l'empreinte.
- [ ] **R3 — Décision client** · CDP · onglet **Décisions** › **Demander une décision**
  - Type matériau, titre « Carrelage séjour », 2 options (grès 60×60 : +0 ; marbre : +1 500 000, +5 jours), échéance ›
    valider.
  - ✅ CLI notifié (cloche + e-mail).
- [ ] **R4 — Le client valide par code** · CLI · **Validations › Décisions** › **Valider** › option marbre ›
  **Recevoir mon code** (e-mail) › code › confirmer.
  - ✅ Décision « validée », figée ; un avenant est créé automatiquement (impact prix) ; elle apparaît dans le
    **Journal des validations** du Passeport et dans *Mon compte › Confiance et confidentialité*.
- [ ] **R5 — Refus d'une décision** · CDP crée une 2e décision ; CLI **Refuser** (motif ≥ 5 caractères).
  - ✅ CDP prévenu, statut « refusée ».
- [ ] **R6 — Avenant** · CDP · onglet **Avenants** › ouvrir l'avenant issu de R4 (ou **Nouvel avenant** avec une
  **Ligne chiffrée**) › **Soumettre au client** ; CLI · **Validations › Avenants** › **Approuver** (code) ; FIN ·
  **Approuver (finance)**.
  - ✅ Montant du contrat mis à jour partout (ERP, tableau de bord client, Passeport).
- [ ] **R7 — Appel de fonds** · FIN · *Finance › Facturation › onglet Appels de fonds* › **Nouvel appel de fonds**
  (projet TEST, jalon « signature 30 % », montant) › **Émettre**.
  - ✅ Facture d'acompte générée (TVA 19,25 %) ; CLI la voit dans **Finances** (Appels de fonds + Factures, PDF) et
    reçoit une notification.
- [ ] **R8 — Paiement en ligne** · CLI · **Finances** › **Payer**
  - ✅ Tant qu'aucun opérateur n'est configuré : message « Aucun moyen de paiement en ligne n'est activé. Contactez
    votre chargé d'affaires. » — comportement attendu (annexe A). Avec MTN / Orange configurés : payer un petit
    montant réel, valider sur le téléphone, **Télécharger le reçu**.
- [ ] **R8 bis — Encaissement hors ligne (virement, chèque, espèces, Mobile Money direct)** · FIN · *Finance ›
  Facturation › onglet Appels de fonds* › appel de R7 › **Enregistrer un encaissement** : **Montant encaissé** = 40 % de
  l'appel (paiement partiel), **Mode de règlement** « Virement bancaire », **Date de valeur** d'hier, **Référence**
  « VIR-TEST-0002 », **Preuve de l'encaissement** (PDF de preuve de virement, annexe D) › **Enregistrer un
  encaissement**.
  - ✅ Message « à approuver par une autre personne » ; la fiche de l'appel affiche **Encaissements à approuver** ; CLI
    ne voit encore rien dans **Paiements et reçus** et son **Payé** est inchangé.
  - Contrôles · FIN : un montant supérieur au reste dû, une date de valeur future, un virement sans référence ou une
    seconde saisie de « VIR-TEST-0002 » sont refusés avec un message clair.
  - FIN · *Finance › Finances › onglet Paiements* › filtres **Sens** « Encaissements » et **Statut** « À approuver » ›
    ouvrir l'encaissement : ✅ bandeau **Encaissement à vérifier**, bouton **Approuver** inactif (double regard),
    **Retirer la saisie** proposé.
  - DIR · même fiche › **Preuve de l'encaissement** (contrôler montant, référence, date) › **Approuver** › confirmer.
    - ✅ Encaissement « Réussi », **Reçu** PDF (date de valeur, référence) ; **Historique** : créé par FIN, approuvé par
      DIR ; l'appel de fonds et sa facture passent « Partiellement payé ».
    - ✅ CLI notifié (« Paiement reçu — merci ») ; **Finances** : **Payé** = montant encaissé, le paiement apparaît dans
      **Paiements et reçus** avec **Reçu** téléchargeable.
- [ ] **R9 — Échéancier** · CLI · **Échelonner** sur la facture › 3 échéances › **Envoyer la demande** ; FIN · *Finance ›
  Échéanciers clients* › **Proposer au client** ; CLI · **Mes échéanciers** › **Accepter par code**.
  - ✅ Échéancier « En cours » ; les relances de la pièce d'origine sont remplacées par celles de l'échéancier.
- [ ] **R10 — Facture client et relance** · FIN · onglet **Factures clients** › **Nouvelle facture** (projet TEST,
  lignes) › **Valider** (FIN ou DIR selon droits) › **Envoyer au client** › **Relancer le client** › **Copier un lien de
  paiement**.
  - ✅ PDF numéroté, CLI notifié, relance reçue par e-mail ; le lien ouvre la page de paiement sans connexion.
  - Solde hors ligne · FIN · facture › **Enregistrer un encaissement** › **Mode de règlement** « Chèque », référence
    « CHQ-TEST-01 », montant 1 000, preuve › enregistrer ; DIR › *Finances › Paiements* › ouvrir › **Refuser** (motif
    « Chèque non reçu à la banque »).
    - ✅ Statut « Annulé », bandeau **Encaissement refusé** avec le motif ; la facture reste due ; rien chez CLI.
  - FIN › **Enregistrer un encaissement** « Espèces » (référence facultative, montant prérempli = reste dû) ; DIR ›
    **Approuver**.
    - ✅ Facture « Payé » (bouton **Enregistrer un encaissement** disparu) ; CLI voit le paiement et son **Reçu** ; la
      facture n'est plus payable dans son espace.
- [ ] **R11 — Avoir** · FIN · facture validée › **Émettre un avoir** (montant, motif).
  - ✅ Avoir visible (onglet **Avoirs**) et reste dû diminué chez le client.
- [ ] **R12 — Messagerie** · CLI · **Messagerie** › écrire au chef de projet avec une pièce jointe ; CDP répond depuis
  *Communication › Messagerie*.
  - ✅ Messages en temps réel, accusés de lecture, notification push si l'application est fermée.
- [ ] **R13 — Appel vidéo** · CDP appelle CLI depuis la conversation (ordinateur ↔ téléphone).
  - ✅ Sonnerie, **Répondre**, image et son dans les deux sens, partage d'écran ; l'appel figure dans *Appels ›
    Historique*.
- [ ] **R14 — SAV** · CLI · **SAV et garanties › Nouvelle demande** (objet « Infiltration fenêtre », catégorie
  étanchéité, priorité haute, description) › **Envoyer la demande** › ajouter une photo.
  - CDP/ADM · *Commercial › SAV* › ticket › **Affecter** (TEC) › TEC (application Terrain, **SAV et entretien**) :
    **Diagnostic** › **Décision garantie** (couvert) › **Planifier une intervention** › **Démarrer** › **Terminer**
    (rapport, fourniture, photos avant/après).
  - CLI › **Valider l'intervention** (étoiles) ; tester aussi **Rouvrir** puis revalider.
  - ✅ Chaque étape est visible chez le client ; délai de résolution affiché ; statistiques SAV à jour.
- [ ] **R15 — Mon bâtiment** · CDP · onglet **Bâtiment et maintenance** › **Ajouter un équipement** (climatisation,
  notice PDF) ; CLI · **Mon bâtiment** › carnet d'entretien › **Planifier une intervention**.
  - ✅ Ticket SAV pré-rempli créé ; **Passeport certifié (PDF)** généré avec QR.
- [ ] **R16 — Dossier Tranquillité et garanties** · CDP · onglets **Tranquillité** (**Nouvelle pièce** « Titre foncier »,
  visible client) et **Garanties** (**Nouvelle garantie** décennale).
  - ✅ CLI voit la pièce avec ses badges (échéance) et la garantie dans **Mon bâtiment**.
- [ ] **R17 — Contenus immersifs** · CDP · onglet **Immersion et digests** › **Nouveau contenu** (photo 360° ou URL de
  visite) publié au client ; **Nouveau résumé** de la semaine.
  - ✅ CLI : **Live, 360° et drone** affiche le contenu ; **Partager** crée un lien de visite pour un proche.
- [ ] **R18 — Configurateur** (si une maquette configurable existe) · ADM · *Projets › Configurateur 3D* › catalogue de
  matériaux + maquette configurable publiée ; CLI · **Configurateur** › choisir des finitions › **Variante** ›
  **Comparer** › soumettre.
  - ✅ Prix et délais mis à jour en direct ; le choix soumis arrive côté CDP. Sans fichier GLB : « non testé ».
- [ ] **R19 — Énergie** · CLI · **Énergie et confort** › simuler › **Intégrer à mon projet**.
  - ✅ Demande visible dans l'onglet **Énergie** du projet (CDP).
- [ ] **R20 — Financement et parrainage** · ADM · *Finance › Financement clients* › **Ouvrir aux clients** ; *Commercial ›
  Ambassadeurs* › **Ouvrir le programme** + **Règles**.
  - ✅ CLI voit les menus **Financement** et **Parrainage** (après rechargement) ; simuler un financement ; copier son
    lien ambassadeur ; une demande déposée via ce lien apparaît dans *Ambassadeurs › Recommandations*. Refermer les
    deux programmes à la fin si vous ne les lancez pas encore.
- [ ] **R21 — Avis client** · CDP · onglet **Avis client** › **Inviter le client** (e-mail) ; CLI · **Mon avis** ›
  témoignage (≥ 20 caractères), photo › envoyer.
  - ✅ Avis reçu ; publication sur le site uniquement avec l'accord du client.
- [ ] **R22 — Passeport projet** · CLI · **Passeport projet** › imprimer en PDF.
  - ✅ Toutes les rubriques reprennent ce qui précède (contrat + avenant, plans en vigueur, décisions, validations).

---

## 10. Finance et direction

- [ ] **F1 — Tableau de bord** · DIR · *Tableau de bord*
  - ✅ CA signé, facturé, créances, dettes fournisseurs, trésorerie 6 mois, marges par chantier, approbations en
    attente : chiffres cohérents avec les phases 3 à 9.
- [ ] **F2 — Pilotage financier** · FIN · *Finance › Finances › onglet Pilotage*
  - ✅ Trésorerie prévisionnelle, marge du projet TEST, créances en retard.
- [ ] **F3 — Banque** · FIN · onglet **Banque** › **Nouveau compte** « TEST Banque » › **Importer et rapprocher** un
  fichier CSV (format en annexe B) contenant la ligne du paiement fournisseur de H14 et celle de l'encaissement
  « VIR-TEST-0002 » de R8 bis.
  - ✅ Les deux lignes sont rapprochées automatiquement (la fiche de l'encaissement montre le **Rapprochement
    bancaire**) ; une ligne inconnue reste à **Rapprocher** manuellement.
- [ ] **F4 — Petite caisse** · FIN › **Nouvelle caisse** (projet TEST, gestionnaire CDC, plafond 200 000) ; CDC ›
  **Déclarer un mouvement** (dépense 15 000, photo du justificatif) ; FIN › **Valider**.
  - ✅ Solde débité seulement après validation.
- [ ] **F5 — Prévisions** · FIN · onglet **Prévisions** › **Nouvelle prévision** (encaissement, probabilité 70 %).
  - ✅ Intégrée à la trésorerie prévisionnelle.
- [ ] **F6 — Balance âgée et export comptable** · FIN · *Facturation › Balance âgée* ; **Export comptable (CSV)** sur le
  mois.
  - ✅ Tranches cohérentes ; le CSV s'ouvre dans Excel avec ventes, achats, règlements.
- [ ] **F7 — Rapports et exports** · DIR · *Rapports* : **Synthèse hebdomadaire**, **Exports** (Excel d'une liste),
  **Anomalies** (lancer une analyse), **Prévisions** (**Recalculer**).
  - ✅ Fichiers téléchargés ; chaque export est tracé dans le journal d'audit.
- [ ] **F8 — Rapport de direction** · DIR · *Rapport de direction* › **Générer** › PDF.
  - ✅ Rapport de la semaine (synthèse IA seulement si la clé IA est active).
- [ ] **F9 — Séquestre** (si utilisé) · DIR · projet › onglet **Séquestre** : convention, appel de fonds placé sous
  séquestre, demande de libération avec preuves ; CLI **Valider la libération** ; double validation interne.
  - ✅ Statuts successifs corrects ; sinon « non testé » (nécessite un partenaire de séquestre).

---

## 11. RH, QHSE, matériel

- [ ] **Q1 — Employé et badge** · FIN (RH) · *RH et QHSE › Ressources humaines › onglet Personnel › Nouvel employé*
  - Prénom, nom « TEST Ouvrier », fonction maçon, date d'embauche, métier maçonnerie, équipe « TEST Équipe gros
    œuvre », compte utilisateur = TEC › enregistrer › **Badge** › **Imprimer**.
  - ✅ Badge QR imprimé.
- [ ] **Q2 — QR d'auto-pointage du chantier** · RH · onglet **Pointage** › *QR d'auto-pointage du chantier* › choisir
  le site S1 › **Imprimer**.
  - ✅ QR imprimé.
- [ ] **Q3 — Pointages** · TEC (application Terrain, **Pointage**) scanne le QR du chantier (arrivée puis départ) ;
  CDC scanne le **badge** de « TEST Ouvrier » ; tester un pointage **hors périmètre** (loin du site).
  - ✅ Arrivées/départs enregistrés ; le hors-périmètre est signalé au responsable ; RH › **Pointages** › **Valider**.
- [ ] **Q4 — Congés** · TEC (application Terrain, **Mon espace RH › Demander**) ; RH › onglet **Congés** › **Accorder**.
  - ✅ TEC voit sa demande acceptée.
- [ ] **Q5 — Paie** · RH › onglet **Paie** › **Nouvelle paie** (mois) › **Ouvrir** › **Ajuster** (prime) ›
  **Recalculer** › **Bulletin** ; DIR (ou FIN si autre personne) › **Valider (finance)** › **Marquer payée**.
  - ✅ Paie figée ; TEC voit son bulletin dans **Mon espace RH** (filigrané, ouverture journalisée).
- [ ] **Q6 — QHSE** · CDC · *QHSE* : incident de T8 › **Analyse des causes** › **Action corrective** (responsable,
  échéance) › **Informer le client** ; responsable › **Démarrer** › **Déclarer réalisée** (preuve) › vérifier ›
  **Clôturer** l'incident.
  - ✅ CLI voit l'encadré « Communiqué au client » dans **Chantier** ; indicateurs QHSE à jour.
- [ ] **Q7 — Inspection** · CDC › **Nouvelle grille** (sécurité, 3 points) › **Nouvelle inspection** › une
  non-conformité › **Terminer l'inspection**.
  - ✅ Action corrective ouverte automatiquement.
- [ ] **Q8 — EPI et quart d'heure** · CDC › **Nouvel EPI** (casque, durée de vie 365 j) › **Remettre un EPI** à
  « TEST Ouvrier » ; **Quart d'heure** (thème, participants).
  - ✅ Remise tracée avec date de renouvellement.
- [ ] **Q9 — Matériel** · CDC/ADM · *Achats et logistique › Matériel* › ajouter « TEST Bétonnière 350 L » ›
  **Affecter à un chantier** › relevé d'utilisation (application Terrain, **Matériel et engins**) › **Nouveau plan** de
  maintenance › **Déclarer un incident** (panne) › **Nouvel ordre** › **Démarrer** › **Terminer** (rapport) ›
  **Retour au dépôt**.
  - ✅ Historique et coûts du matériel à jour.

---

## 12. Application GLOBUS Direction

- [ ] **D1 — Connexion** · DIR · téléphone, application **GLOBUS Direction** (code MFA obligatoire).
  - ✅ Tableau de bord identique aux chiffres du web (F1).
- [ ] **D2 — Valider en déplacement** · CDC crée une nouvelle demande d'achat (web ou Terrain) ; DIR · onglet
  **Validations › Achats** › **Approuver**.
  - ✅ La notification touchée ouvre directement la demande ; l'approbation apparaît immédiatement dans l'ERP web.
- [ ] **D3 — Paiement et situation** · FIN crée un ordre de paiement ; DIR · **Validations › Paiements** › **Approuver** ;
  idem pour une situation (**Validations › Situations**).
  - ✅ Statuts synchronisés avec le web.
- [ ] **D4 — Gérer** · DIR · **Chantiers** › fiche TEST (budget, indice de confiance, photos, incidents) ;
  **Administration** › utilisateurs (déverrouiller un compte, déconnecter partout).
  - ✅ Actions tracées dans le journal d'audit.

---

## 13. Communication et notifications

- [ ] **N1 — Push web** · chaque persona · *Mon compte › Notifications* › **Activer le push** (navigateur).
  - ✅ Une notification arrive navigateur réduit (ex. pendant R3 / H2).
- [ ] **N2 — Préférences** · CLI · décocher l'e-mail pour une catégorie › déclencher l'événement correspondant.
  - ✅ Plus d'e-mail pour cette catégorie, mais la notification reste dans l'application.
- [ ] **N3 — Journal des envois** · ADM · *Paramètres › onglet Notifications › Journal des envois*
  - ✅ Les e-mails des phases précédentes sont « envoyés » ; aucun échec inexpliqué (les envois WhatsApp/SMS échouent
    tant que ces canaux ne sont pas configurés — annexe A).
- [ ] **N4 — Messagerie de groupe et de projet** · CDP crée une conversation de projet avec CDC et TEC, pièce jointe,
  réponse à un message, **Rechercher dans les messages**.
  - ✅ Fonctionne sur le web et dans les applications mobiles.
- [ ] **N5 — Documentation intégrée** · chaque persona · *Aide › Documentation* et l'icône **?** en haut de chaque écran.
  - ✅ Chacun ne voit que les guides de son rôle ; la recherche fonctionne.

---

## 14. Site web, marketing, analytics

- [ ] **W1 — Modération du commentaire** · ADM · *Site web › Contenus (CMS) › onglet Commentaires* › commentaire de
  V10 › **Publier et répondre** (ou **Publier**).
  - ✅ Commentaire et réponse visibles sous l'article.
- [ ] **W2 — Page et menu** · ADM · *CMS › Pages › Nouvelle page* (titre « TEST Page recette », une section, un bloc
  texte) › **Enregistrer** › **Publier directement** ; *onglet Navigation* › ajouter un élément vers cette page dans
  « Pied de page — principal » › **Publier le menu**.
  - ✅ Page et lien visibles sur le site en quelques secondes. Puis supprimer le lien, archiver et supprimer la page.
- [ ] **W3 — Collection** · ADM · *CMS › Collections › Articles › Nouveau — Articles* (titre, contenu) › soumettre ›
  publier › vérifier sur le site › archiver.
  - ✅ Circuit brouillon → publié → archivé respecté.
- [ ] **W4 — SEO** · ADM · *Site web › SEO* › **Optimiser** une page › enregistrer ; onglet **Redirections** ›
  **Nouvelle redirection** `/test-ancienne` → `/` › tester l'adresse dans le navigateur › supprimer la redirection.
  - ✅ Redirection effective ; `/sitemap.xml` et `/robots.txt` s'ouvrent.
- [ ] **W5 — Newsletter** · ADM · *Commercial › Newsletter* : abonné de V8 « confirmé » › **Nouveau segment** (tag TEST)
  › **Nouveau modèle** › **Nouvelle campagne** vers ce segment › **Envoyer maintenant**.
  - ✅ E-mail reçu sur `+news` avec lien de désinscription fonctionnel.
- [ ] **W6 — Analytics** · ADM · *Site web › Analytics*
  - ✅ Les visites et conversions de la phase 2 (« Décrire mon projet », contact, newsletter) apparaissent (si le
    consentement a été accepté lors d'au moins une visite).
- [ ] **W7 — Médiathèque** · ADM · *Site web › Médiathèque* › **Envoyer des fichiers** (une image) › renseigner le texte
  alternatif › tenter d'**Archiver** une image utilisée par une page.
  - ✅ Archivage d'une image utilisée refusé avec la liste des pages qui l'utilisent.

---

## 15. Sécurité et contrôles « négatifs »

Ces tests vérifient que chacun **ne peut pas** faire ce qui ne le concerne pas.

- [ ] **X1 — Cloisonnement des menus** · TEC · ✅ pas de menus Finance, CRM, Administration ; saisir directement
  `/erp/finances` dans la barre d'adresse ⇒ accès refusé.
- [ ] **X2 — Cloisonnement client** · CLI · tenter `/erp` ⇒ refus ; ✅ aucune donnée interne (prix d'achat, notes
  internes, autres projets) dans l'espace client.
- [ ] **X3 — Cloisonnement partenaires** · FOU · ✅ ne voit ni les consultations de sous-traitance, ni les autres
  fournisseurs ; STT ne voit pas les commandes fournisseurs.
- [ ] **X4 — Séparation des tâches** · ✅ (déjà vu en H3, H13) aucun utilisateur ne peut approuver ce qu'il a créé.
- [ ] **X5 — Verrouillage** · Visiteur · 5 mauvais mots de passe d'affilée sur le compte TEC.
  - ✅ Compte verrouillé temporairement ; ADM › *Sécurité › Synthèse* le liste ; *Utilisateurs* › **Déverrouiller**.
- [ ] **X6 — Mot de passe oublié** · TEC · `/connexion` › **Mot de passe oublié ?** › e-mail › lien › nouveau mot de passe.
  - ✅ Ancien mot de passe refusé, nouveau accepté.
- [ ] **X7 — Sessions** · CDC · *Mon compte › Sessions et appareils* › **Fermer les autres sessions**.
  - ✅ L'application Terrain est déconnectée.
- [ ] **X8 — Réinitialiser la MFA** · ADM · *Utilisateurs* › CDC › **Réinitialiser la MFA** (confirmé par votre code).
  - ✅ CDC doit reconfigurer sa double authentification à la connexion suivante.
- [ ] **X9 — Opération sensible** · ADM · *Paramètres › Intégrations* › **Régler** un secret quelconque › annuler.
  - ✅ La fenêtre **Confirmer avec votre double authentification** apparaît si la session n'est pas confirmée.
- [ ] **X10 — Mode maintenance** · ADM · *Paramètres › onglet Maintenance* › message « Test de maintenance », fin dans
  15 min › **Activer** ; vérifier avec CLI (message affiché) ; **Terminer la maintenance**.
  - ✅ Seuls les administrateurs accèdent pendant la maintenance ; tout revient à la normale après.
- [ ] **X11 — Journal d'audit** · ADM · *Administration › Journal d'audit* › rechercher le projet TEST › vérifier
  l'intégrité.
  - ✅ Toutes les actions des phases 1 à 15 sont tracées ; « Chaîne d'audit intègre ».
- [ ] **X12 — Désactivation** · ADM · *Utilisateurs* › un compte de test › **Désactiver le compte**.
  - ✅ Connexion refusée pour ce compte ; **Réactiver** fonctionne.

---

## 16. Clôture de la recette

- [ ] **Z1 — Bilan** : compter les étapes OK / KO / non testées ; trier les anomalies par gravité (bloquante, majeure,
  mineure, cosmétique). Critère de livraison conseillé : **0 bloquante, 0 majeure** sur les phases 1 à 9 et 15.
- [ ] **Z2 — Nettoyage, option 1 (garder les données)** :
  - Projet « TEST — Villa Mballa » › **Archiver** ; désactiver les 10 comptes de test (*Utilisateurs* › **Désactiver le
    compte**) ; organisations TEST › statut inactif / liste noire si proposé ; fournisseur et sous-traitant TEST ›
    **Changer le statut** « suspendu » ; refermer Financement et Parrainage s'ils ne sont pas lancés ; supprimer la page
    et l'article de test (W2, W3).
- [ ] **Z3 — Nettoyage, option 2 (revenir à la sauvegarde P3)** :
  - *Paramètres › Système et sauvegardes* › nouvelle sauvegarde **Complète** de l'état « après recette » (au cas où) ›
    sur la sauvegarde P3 : **Restaurer** › justification (20 caractères min.) › code MFA › taper `RESTAURER`.
  - ✅ Après redémarrage, la plateforme est revenue à l'état d'avant la recette (comptes de test et données TEST
    disparus). Les e-mails déjà envoyés ne peuvent évidemment pas être rappelés.
- [ ] **Z4 — Procès-verbal** : date, personnes, version testée (affichée sur la page Système), résultat, réserves
  éventuelles et date de levée.

---

## Annexe A — Limites connues (au 20/10/2026)

| Fonction | État | Effet pendant la recette |
| --- | --- | --- |
| **Paiement en ligne** (MTN MoMo, Orange Money, carte) | non configuré (contrats opérateurs à signer, clés à saisir dans *Intégrations*) | R8 affiche « Aucun moyen de paiement en ligne n'est activé » : attendu |
| **Encaissement d'un client hors ligne** (virement, espèces, chèque, dépôt Mobile Money direct) | disponible : **Enregistrer un encaissement** (appel de fonds, facture) avec preuve, approuvé par une autre personne dans *Finances › Paiements* | tester R8 bis et R10 ; c'est le moyen de faire passer les pièces « Payé » tant que le paiement en ligne n'est pas configuré |
| **WhatsApp** et **SMS** | non configurés | choisir l'**e-mail** pour recevoir les codes ; les envois WhatsApp/SMS figurent « échoués » dans le journal |
| **IA (Claude)** | clé refusée, à renouveler dans *Intégrations* | estimation instantanée, lecture de pièces, synthèses et assistant en mode IA dégradés (l'assistant répond par règles) |
| **Google Maps** | clé à saisir | cartes du site et position sur carte indisponibles |
| **iPhone** | applications non signées (pas de compte Apple Developer) | tester les applications mobiles sur Android uniquement |
| **Séquestre / financement bancaire** | nécessitent un partenaire réel | F9 et la transmission bancaire de R20 « non testés » |

## Annexe B — Jeu de données de test

- **Client** : Paul TEST-MBALLA, `votre.adresse+client@gmail.com`, Douala, univers HOME, villa 180 m² R+1,
  budget 20–30 M XAF.
- **Devis** : Études et plans 3 000 000 ; Gros œuvre 15 000 000 ; Second œuvre 7 000 000 ; TVA 19,25 % ;
  échéancier 30 / 40 / 30.
- **Fournisseur** : TEST Quincaillerie du Wouri — Ciment CPJ 42.5, sac 50 kg, 5 200 XAF (contre-offre 5 000).
- **Sous-traitant** : TEST Électricité Akwa — lot électricité : tableau 350 000 × 1, points lumineux 25 000 × 30.
- **Relevé bancaire CSV** (F3) — séparateur point-virgule, montants sans espace, une ligne par opération :

```
date;libellé;référence;montant
20/10/2026;VIR TEST QUINCAILLERIE;VIR-TEST-0001;-508760
20/10/2026;VIR RECU TEST-MBALLA;VIR-TEST-0002;3000000
21/10/2026;FRAIS TENUE DE COMPTE;;-2500
```

  Remplacez les montants par celui du paiement exécuté en H14 (montant négatif = sortie) et par celui de l'encaissement
  approuvé en R8 bis (positif = entrée) ; les références « VIR-TEST-0001 » et « VIR-TEST-0002 » sont celles saisies à
  l'exécution et à l'encaissement : ce sont elles qui permettent le rapprochement automatique.

## Annexe C — Fiche anomalie (à recopier pour chaque problème)

```
N° étape        : (ex. H11)
Persona / appareil : (ex. FIN — Chrome Windows / CDC — Android Terrain)
Date et heure   :
Ce que j'ai fait :
Ce que j'attendais :
Ce qui s'est passé : (message exact affiché, capture d'écran)
Gravité         : bloquante / majeure / mineure / cosmétique
```

Joignez la **référence** affichée dans les messages « Erreur interne. Référence : … » : elle permet de retrouver
l'incident dans les journaux du serveur.

## Annexe D — Fichiers à préparer

- 2 PDF quelconques (« Plan RDC », « Plan RDC v2 ») et 1 PDF de contrat signé scanné.
- 1 PDF de facture fournisseur et 1 PDF de facture sous-traitant, 1 PDF de preuve de virement.
- 1 PDF « mémoire technique », 1 PDF d'attestation fiscale.
- 6 photos de chantier prises avec le téléphone (position activée).
- Optionnel : une maquette IFC ou RVT (Hub BIM), un fichier GLB (configurateur), une photo 360°.
