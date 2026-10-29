# La Villa Mballa

## Le manuel de recette de la plateforme GLOBUS ENGINEERING

*Une seule histoire, du premier visiteur du site jusqu'à la remise des clés d'une villa, pour vérifier pas à pas que
toute la plateforme fonctionne : le site vitrine, l'ERP du personnel, l'espace client, l'extranet des partenaires et les
trois applications mobiles.*

---

## Sommaire

- **Mode d'emploi** — comment lire une scène, les conventions, les personnages, les services non encore activés
- **Livre I — Les préparatifs** : chapitre 1 (le matériel), chapitre 2 (l'état de la plateforme)
- **Livre II — Les fondations** : chapitre 3 (organisations, partenaires, comptes du personnel)
- **Livre III — La rencontre** : chapitre 4 (le site vitrine), chapitre 5 (du prospect aux études), chapitre 6 (l'espace client)
- **Livre IV — Le chantier se prépare** : chapitre 7 (le projet et les études : plans, 3D, validation, facture d'études,
  remise des livrables), chapitre 8 (le devis des travaux et le contrat), chapitre 9 (les achats), chapitre 10 (la
  sous-traitance)
- **Livre V — La vie du chantier** : chapitres 11 à 15 (terrain, client, finances, RH-QHSE, direction mobile)
- **Livre VI — Autour de la maison** : chapitres 16 à 18 (communication, site web, sécurité)
- **Épilogue** — chapitre 19 (le bilan et le nettoyage)
- **Annexes** — A (ce qui dépend d'un service non activé), B (données de l'histoire), C (fiche d'anomalie),
  D (fichiers à préparer), E (tableau de bord de la recette), F (que faire si…), G (référence des formulaires)

---

## Mode d'emploi

### À quoi sert ce manuel

Une **recette**, c'est l'essai complet d'un logiciel avant de le livrer : on joue de vraies situations et on vérifie
que chaque écran fait ce qu'il doit. Ce manuel déroule une histoire réaliste — la construction de la villa de Paul
Mballa à Douala — et chaque étape de l'histoire est une **scène** à jouer sur la plateforme.

Il est écrit pour quelqu'un qui n'est pas informaticien : chaque clic est décrit, chaque champ à remplir est nommé
exactement comme à l'écran.

### Le parcours du client chez GLOBUS

L'histoire suit l'ordre réel de l'entreprise : **les études d'abord**.

1. Le prospect laisse son projet sur le site (lead), le commercial le qualifie et en fait une opportunité.
2. **Démarrer les études** : le projet naît au statut « Étude », le client reçoit son espace.
3. GLOBUS conçoit : plans, rendus 3D, maquette, options. Le client les **consulte en aperçu filigrané** et les **valide**
   par code.

4. La **facture d'études** est émise ; dès qu'elle est réglée, les **originaux sont remis** au client (ils deviennent les
   siens).

5. Le **devis des travaux**, fondé sur ces études, est accepté par code ; le **contrat** signé se **rattache au même
   projet** (budget, lots, jalons de paiement).

6. Le chantier : achats, sous-traitance, terrain, appels de fonds, réception, garantie.

### Comment se présente une scène

Chaque scène suit toujours le même plan :

> ### Scène A9 — Créer les comptes du personnel
> **Pourquoi** : ce que la scène vérifie, et pourquoi c'est important.
> **Qui** : le personnage qui agit (et donc le profil de navigateur à utiliser). **Où** : le menu et l'écran.
> **Avant** : ce qui doit déjà être fait (si besoin).
> **Méthode** : les gestes, numérotés, dans l'ordre.
> **Les champs** : un tableau des champs du formulaire, avec la valeur à saisir.
> **Résultat attendu** : ce que vous devez voir. Si ce n'est pas le cas, c'est une anomalie (annexe C).
> - [ ] la case à cocher de la scène.

### Les conventions d'écriture

| Écriture | Signification |
| --- | --- |
| **Nouveau fournisseur** (en gras) | Un bouton, un onglet, un menu ou un titre **exactement** comme à l'écran. |
| *Achats et logistique › Fournisseurs* | Le chemin dans le menu de gauche : la rubrique, puis l'entrée. |
| `TEST Quincaillerie du Wouri` | Le texte à taper, tel quel. |
| « Fournisseur » | Une valeur à **choisir** dans une liste déroulante ou à cocher. |
| ★ | Champ **obligatoire** : il porte un astérisque rouge à l'écran, le formulaire refuse d'enregistrer s'il est vide. |
| *(vide)* | Laissez le champ vide. |

**Dans les tableaux de champs**, les champs sont listés **dans l'ordre où ils apparaissent à l'écran**. Les champs du
formulaire qui ne sont pas cités sont **facultatifs : laissez-les vides** (ou à leur valeur proposée). La liste complète
de chaque formulaire, avec tous ses champs, se trouve dans le document `docs/FORMULAIRES.md` (annexe G).

**Les listes déroulantes « à recherche »** (projets, fournisseurs, utilisateurs, organisations…) : cliquez dans le
champ, tapez les premières lettres (par exemple `TEST`), puis cliquez sur la bonne ligne.

**Les champs « mots-clés »** (catégories, zones, étiquettes…) : tapez un mot puis appuyez sur **Entrée** ; le mot
devient une petite étiquette. Recommencez pour chaque mot.

**Les dates** : cliquez dans le champ et choisissez dans le calendrier. Quand le manuel dit « dans 30 jours », comptez à
partir du jour où vous jouez la scène.

**Les montants** sont en francs CFA (FCFA), sans espace ni point : `25000000` pour vingt-cinq millions.

### Combien de temps

Comptez **trois à quatre journées** pour tout jouer, en respectant l'ordre des chapitres : chaque chapitre a besoin de
ce qui a été créé dans les précédents (on ne peut pas commander du ciment pour un projet qui n'existe pas encore).

### Si quelque chose ne marche pas

1. Relisez la scène : un champ ★ oublié, une valeur mal choisie ?
2. Lisez le message affiché : la plateforme dit toujours ce qui manque (« Champ obligatoire », « Choisissez… »).
3. Notez l'anomalie sur la fiche de l'annexe C (scène, écran, ce que vous avez fait, ce que vous avez vu, capture
   d'écran) et passez à la scène suivante si elle ne dépend pas de celle-ci.

### Les services pas encore activés : ce n'est pas un problème

Plusieurs services dépendent de comptes à ouvrir chez des prestataires : **paiement en ligne** (MTN Mobile Money,
Orange Money, carte bancaire), **WhatsApp Business**, **SMS** et les **assistants IA** (Claude). Tant qu'ils ne sont pas
activés (*Administration › Paramètres*, onglet **Intégrations**, bloc **Activer les services**), **la recette se joue
quand même** :

- tout ce qui passe par WhatsApp ou SMS est aussi envoyé **par e-mail**, et c'est l'e-mail que la recette vérifie ;
- les paiements du client se testent avec les **encaissements hors plateforme** (virement, chèque, espèces, Mobile Money
  reçu directement), qui suivent exactement le même circuit comptable ;
- les écrans qui demandent un service absent l'**indiquent clairement** (par exemple « Aucun moyen de paiement en ligne n'est activé. Contactez votre chargé
  d'affaires. ») : la recette vous demande alors simplement de **vérifier ce message**.

Chaque scène concernée porte la mention **Si le service est activé / s'il ne l'est pas**, et l'annexe A les récapitule :
vous les rejouerez le jour où le service sera branché.

---

## Les personnages

Onze personnages, chacun avec son propre compte et sa propre adresse e-mail. Vous les jouerez tous.

| Code | Personnage | Ce qu'il fait | Rôle(s) à cocher | Métier (liste) | Fonction (texte) | Adresse e-mail |
| --- | --- | --- | --- | --- | --- | --- |
| ADM | **Vous, le Gardien** | Administre la plateforme | « Administrateur / DG » (déjà en place) | — | — | votre adresse habituelle |
| DIR | **Grâce** TEST-EWANE | Directrice : approuve et contrôle | « Direction / Responsable » | *(vide)* | `Directrice des opérations` | `votre.adresse+direction@gmail.com` |
| COM | **Jordan** TEST-NKENG | Commercial : du prospect au contrat | « Commercial » | *(vide)* | `Commercial` | `votre.adresse+commercial@gmail.com` |
| CDP | **Samuel** TEST-FOTSO | Ingénieur chef de projet | « Chef de projet / Conducteur de travaux » | *(vide)* | `Ingénieur chef de projet` | `votre.adresse+chefprojet@gmail.com` |
| CDC | **Ernest** TEST-TCHOUA | Chef de chantier, magasinier, sécurité | « Chef de chantier » + « Magasinier » + « Responsable QHSE » | « Gros œuvre » | `Chef de chantier` | `votre.adresse+chantier@gmail.com` |
| ACH | **Linda** TEST-MBARGA | Acheteuse | « Acheteur / Logistique » | *(vide)* | `Acheteuse` | `votre.adresse+achat@gmail.com` |
| FIN | **Rachel** TEST-NDONGO | Comptable et RH | « Finance / Comptabilité » + « Ressources humaines » | *(vide)* | `Comptable` | `votre.adresse+finance@gmail.com` |
| TEC | **Moussa** TEST-BELLO | Électricien, SAV, pointage | « Artisan / Technicien » | « Électricité » | `Électricien` | `votre.adresse+technicien@gmail.com` |
| FOU | **Martin** TEST-KAMGA | Gérant de *TEST Quincaillerie du Wouri* | « Fournisseur » | *(vide)* | `Gérant` | `votre.adresse+fournisseur@gmail.com` |
| STT | **Sylvie** TEST-ABENA | Gérante de *TEST Électricité Akwa* | « Sous-traitant » | *(vide)* | `Gérante` | `votre.adresse+soustraitant@gmail.com` |
| CLI | **Paul** TEST-MBALLA | Le client | « Client » — son compte se crée **tout seul** au lancement des études (scène C8) | — | — | `votre.adresse+client@gmail.com` |

> **Attention, deux mots qui se ressemblent.** Le **rôle** (cases à cocher « Rôles ») donne les droits dans la
> plateforme : « Chef de chantier » est un rôle. Le **métier** (liste « Métier ») décrit le savoir-faire de la
> personne : « Gros œuvre », « Électricité »… « Chef de chantier » **n'est pas** un métier.

**Une seule boîte Gmail suffit.** Gmail ignore ce qui suit le signe **+** : un e-mail envoyé à
`jean.dupont+client@gmail.com` arrive dans la boîte de `jean.dupont@gmail.com`. Pour la plateforme, ce sont pourtant des
adresses différentes, donc des personnes différentes. Dans tout le manuel, remplacez `votre.adresse` par la partie de
votre adresse Gmail avant le `@`.

> **Règle d'or.** N'utilisez **jamais** votre propre adresse (celle du Gardien) pour un autre personnage, surtout pas
> pour Paul : si l'adresse existe déjà, la plateforme rattache le projet à ce compte au lieu de créer le client.

**Pourquoi autant de personnages ?** La plateforme applique la **séparation des tâches** : personne n'approuve ce qu'il a
lui-même demandé ou saisi. Ernest demande du ciment, Grâce approuve ; Rachel prépare un paiement, Grâce le valide. Pour
tester ces circuits, il faut plusieurs comptes.

**Qui voit quoi.** Certains rôles voient **tous** les projets (Direction, Commercial, Acheteur, Finance, Magasinier,
QHSE, RH) ; d'autres ne voient **que les projets dont ils sont membres** (Chef de projet, Chef de chantier, Artisan /
Technicien) : c'est pourquoi la scène M2 ajoute Samuel, Ernest et Moussa à l'équipe du projet.

**La double authentification** (le code à 6 chiffres de l'application du téléphone) est **obligatoire** pour les rôles
« Administrateur / DG », « Direction / Responsable » et « Finance / Comptabilité » (donc pour vous, Grâce et Rachel), et
conseillée pour tous les autres.

---

## Petit lexique

| Mot | Sens |
| --- | --- |
| **ERP** | L'espace de travail du personnel : `https://globus-engineering-sarl.com/erp`. |
| **Espace client** | L'espace de Paul : suivi du chantier, documents, décisions, paiements. |
| **Extranet** | L'espace des partenaires (fournisseurs, sous-traitants). |
| **Vitrine** | Le site public de l'entreprise. |
| **Lead** | Un prospect : quelqu'un qui a laissé ses coordonnées et un projet. |
| **Opportunité** | Une affaire en cours de négociation avec un prospect. |
| **OTP** | Un code à usage unique reçu par e-mail pour confirmer une décision (accepter un devis, signer). |
| **Double authentification (MFA)** | Le second verrou du compte : le code à 6 chiffres de l'application du téléphone. |
| **GED** | La gestion des documents : plans, contrats, PV, avec leurs versions. |
| **BIM / maquette** | La maquette numérique 3D du bâtiment. |
| **Situation de travaux** | La facture d'avancement d'un sous-traitant (« j'ai fait 30 % »). |
| **Rapprochement « trois pièces »** | Vérifier qu'une facture fournisseur correspond à la commande et à la réception. |
| **Séquestre** | Argent bloqué chez un tiers, libéré à une étape du chantier. |
| **QHSE** | Qualité, hygiène, sécurité, environnement. |
| **EPI** | Équipement de protection individuelle (casque, gants…). |

---

# Livre I — Les préparatifs

*Avant de poser la première pierre, un bon chef de chantier prépare ses outils. Ce livre ne se fait qu'une fois.*

## Chapitre 1 — Le matériel

### 1.1 Une décision à prendre avant tout

**Pourquoi** : l'essai se joue sur la vraie plateforme. Le projet de Paul, ses factures, les comptes des personnages vont
réellement exister et consommer de vrais numéros. Il faut décider dès maintenant de ce qu'ils deviendront.

- **Premier chemin — garder les traces.** Tout ce que vous créez porte « TEST » dans son nom ; à la fin, vous archivez le
  projet et désactivez les comptes (scène Z2). Les numéros consommés (code projet, factures) ne reviennent pas.
- **Second chemin — effacer l'essai (recommandé avant la mise en service).** À la fin, le Gardien lance la **remise à
  zéro des données d'exploitation** (scène Z6) : comptes, projets et données métier sont supprimés ; le **site, le CMS,
  la médiathèque, les paramètres et les intégrations sont conservés** ; la numérotation repart de zéro.

> **Partir d'une base propre.** Si la plateforme contient déjà des données d'essais précédents, faites la remise à zéro
> (scène Z6) **avant** de commencer.

- [ ] J'ai choisi mon chemin et je m'y tiens.

### 1.2 Préparer les adresses e-mail

**Méthode**

1. Recopiez sur une feuille les adresses du tableau des personnages, en remplaçant `votre.adresse` par la vôtre.
2. Ajoutez trois adresses de service : `votre.adresse+contact@gmail.com` (un visiteur du site),
   `votre.adresse+news@gmail.com` (un abonné à la lettre d'information) et `votre.adresse+erreur@gmail.com` (une
   invitation envoyée par erreur).

3. Gardez Gmail ouvert pendant tout l'essai. Si un e-mail tarde, regardez dans **Spam** et dans l'onglet **Promotions**.

- [ ] Les quatorze adresses sont notées.

### 1.3 Un profil de navigateur par personnage

**Pourquoi** : un navigateur ne garde qu'une connexion à la fois. Avec un **profil Chrome** par personnage, chacun garde
sa propre fenêtre connectée, et vous passez de l'un à l'autre sans vous déconnecter.

**Méthode** (Google Chrome, sur l'ordinateur)

1. En haut à droite de Chrome, cliquez sur le **rond de votre profil** (photo, initiale ou silhouette).
2. Cliquez sur **Ajouter** (ou **+ Ajouter un profil**), puis **Continuer sans compte**.
3. Nommez le profil **GLOBUS ADM**, choisissez une couleur, cliquez sur **Terminé**.
4. Recommencez pour : **GLOBUS DIR**, **GLOBUS COM**, **GLOBUS CDP**, **GLOBUS CDC**, **GLOBUS ACH**, **GLOBUS FIN**,
   **GLOBUS TEC**, **GLOBUS FOU**, **GLOBUS STT**, **GLOBUS CLI**, et **Visiteur** (personne de connecté).

**Résultat attendu** : un clic sur le rond du profil affiche les douze profils ; chacun ouvre sa propre fenêtre.

> N'utilisez pas la navigation privée pour jouer deux personnages : toutes les fenêtres privées partagent la même
> session.

- [ ] Les douze profils existent.

### 1.4 L'application d'authentification

1. Sur votre téléphone, installez **Google Authenticator** (ou **Microsoft Authenticator**) depuis le Play Store ou
   l'App Store.

2. Ouvrez-la une fois. Elle est vide : chaque personnage y ajoutera sa ligne à la scène A12.

- [ ] L'application est installée.

### 1.5 Les applications GLOBUS sur un téléphone Android

**Pourquoi** : Ernest travaille sur le chantier avec l'application **GLOBUS Terrain**, Grâce valide en déplacement avec
**GLOBUS Direction**, Paul suit sa villa avec **GLOBUS Client**.

**Méthode**

1. Récupérez les trois fichiers d'installation : `GLOBUS-Terrain.apk`, `GLOBUS-Direction.apk`, `GLOBUS-Client.apk`
   (dossier `dist\mobile\` du projet sur l'ordinateur de travail, ou sur GitHub : *Actions* › dernière exécution réussie
   › section *Artifacts*).

2. Copiez-les sur le téléphone (câble USB en mode **Transfert de fichiers**, dossier **Download** ; ou via Google Drive).
3. Sur le téléphone, application **Fichiers** › **Téléchargements**, touchez chaque fichier `.apk`. Si Android demande,
   touchez **Paramètres** › **Autoriser cette source**, revenez, puis **Installer**.

**Résultat attendu** : trois icônes GLOBUS sur le téléphone. Ne les ouvrez pas encore.

> L'idéal est d'avoir deux téléphones (un pour Ernest, un pour Grâce et Paul). Les iPhone ne peuvent pas encore installer
> ces applications (annexe A).

- [ ] Les trois applications sont installées.

### 1.6 Les fichiers de l'histoire

Préparez dans un dossier de l'ordinateur les fichiers de l'annexe D : quelques PDF (n'importe lesquels, renommés « Plan
RDC », « Facture fournisseur »…) et une demi-douzaine de photos prises avec le téléphone, **localisation activée**.
Prévoyez une **imprimante** ou un second écran : plusieurs QR codes devront être scannés.

- [ ] Les fichiers sont prêts.

## Chapitre 2 — L'état de la plateforme

### Scène P1 — Les voyants des services

**Pourquoi** : chaque service extérieur (e-mail, notifications, maquettes 3D, antivirus…) a un voyant. On note ce qui est
branché et ce qui ne l'est pas encore.

**Qui** : le Gardien (profil **GLOBUS ADM**). **Où** : *Administration › Paramètres*, onglet **Intégrations**.

**Méthode**

1. Ouvrez `https://globus-engineering-sarl.com/connexion`, connectez-vous (e-mail, mot de passe, puis code à 6 chiffres).
2. Menu de gauche : *Administration › Paramètres*, puis l'onglet **Intégrations**.
3. Lisez la rangée de cartes en haut, puis le bloc **Activer les services** et la liste **Clés et secrets des
   prestataires**.

**Résultat attendu**

- Coche verte sur : **E-mail**, **Notifications push web**, **Notifications push mobile**, **Autodesk APS (BIM)**,
  **Reconnaissance vocale serveur**, **Antivirus des fichiers**, **Temps réel multi-serveurs (Redis)**, **Relais
  d'appels (TURN)**.
- Croix possibles, **attendues tant que le service n'est pas activé** : **WhatsApp Business**, **SMS**, **Paiements**,
  **IA (Claude)**.
- Dans **Clés et secrets des prestataires**, aucune clé marquée **Requis** non renseignée (les clés « Non utilisé »
  concernent des services non activés : rien à faire).

Notez les croix sur votre feuille : les scènes qui en dépendent sont signalées (annexe A).

- [ ] **P1** — Les voyants sont relevés.

### Scène P2 — Le moteur de la plateforme

**Pourquoi** : des tâches automatiques tournent en arrière-plan (envois, relances, sauvegardes). On vérifie qu'elles
fonctionnent.

**Qui** : le Gardien. **Où** : *Administration › Paramètres*, bouton **Système et sauvegardes** (en haut de la page).

**Méthode** : cliquez sur **Système et sauvegardes** ; lisez les indicateurs du haut, puis le bloc **Tâches planifiées**.

**Résultat attendu**

- **Événements en échec** : `0` (vert).
- **Dernière sauvegarde** : il y a moins de 24 heures.
- **Tâches planifiées** : aucune en erreur.

- [ ] **P2** — Le moteur est en bonne santé.

### Scène P3 — La sauvegarde de départ

**Pourquoi** : avoir un point de retour avant l'essai.

**Qui** : le Gardien. **Où** : *Paramètres › Système et sauvegardes*, bloc des sauvegardes.

**Méthode**

1. Dans la liste **Type**, choisissez « Complète ».
2. Cliquez sur **Sauvegarder maintenant**. La sauvegarde se fait en arrière-plan : patientez quelques minutes et
   actualisez la page jusqu'à la voir terminée.

3. Sur cette sauvegarde, cliquez sur **Vérifier**.

**Résultat attendu** : la vérification confirme l'intégrité (empreinte et signature correctes).

- [ ] **P3** — Sauvegarde complète faite et vérifiée.

### Scène P4 — Vérifier que la sauvegarde se restaure

**Pourquoi** : une sauvegarde jamais restaurée n'est pas une garantie. Le test se fait dans une base à part : la vraie
plateforme n'est pas touchée.

**Méthode** : sur la sauvegarde de P3, cliquez sur **Test de restauration**, attendez la fin.

**Résultat attendu** : test réussi. **Notez la date et l'heure** de cette sauvegarde : c'est votre point de retour.

- [ ] **P4** — Test de restauration réussi, date notée.

---

# Livre II — Les fondations

*Avant qu'un client ne frappe à la porte, il faut que les partenaires soient enregistrés, que chacun ait sa clé et que
les équipes soient formées.*

## Chapitre 3 — Organisations, partenaires et comptes

### Scène A1 — Le Gardien entre dans l'ERP

**Qui** : le Gardien (profil **GLOBUS ADM**). **Où** : `https://globus-engineering-sarl.com/connexion`.

**Méthode**

1. Remplissez **Adresse e-mail** et **Mot de passe**, cliquez sur **Se connecter**.
2. Tapez le code à 6 chiffres de l'application du téléphone dans **Code de l'application d'authentification**, cliquez
   sur **Vérifier**.

3. Parcourez le menu de gauche.

**Résultat attendu** : vous arrivez sur le **Tableau de bord** ; le menu montre toutes les rubriques (Projets, Achats et
logistique, Sous-traitance, Finance, Commercial, RH et QHSE, Site web, Communication, Administration).

- [ ] **A1** — Connexion réussie, toutes les rubriques visibles.

### Scène A2 — Les rôles et leurs droits

**Pourquoi** : comprendre ce qu'ouvre chaque rôle avant de les distribuer.

**Qui** : le Gardien. **Où** : *Administration › Utilisateurs et rôles*, onglet **Rôles et permissions**.

**Méthode**

1. Repérez la carte « Chef de chantier » : elle indique son public, le nombre de permissions, et les badges éventuels
   **MFA** (double authentification obligatoire) et **Tous projets** (voit tous les projets).

2. Cliquez sur **Modifier** sur cette carte : la grille des permissions s'ouvre.
3. Regardez sans rien changer, puis fermez la fenêtre **sans enregistrer**.

**Résultat attendu** : la grille s'affiche ; les cartes « Direction / Responsable » et « Finance / Comptabilité » portent
le badge **MFA** ; « Chef de chantier » ne porte pas **Tous projets**.

- [ ] **A2** — Les rôles et leurs droits s'affichent.

### Scène A3 — L'organisation du fournisseur

**Pourquoi** : une **organisation** est une société connue de la plateforme. Celle de Martin ouvrira plus tard la porte
de l'extranet fournisseur.

**Qui** : le Gardien. **Où** : *Administration › Utilisateurs et rôles*, onglet **Organisations**.

**Méthode**

1. Cliquez sur **Nouvelle organisation**. La fenêtre **Nouvelle organisation** s'ouvre.
2. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `TEST Quincaillerie du Wouri` | ★ |
| Type | « Fournisseur » | ★ |
| E-mail | `votre.adresse+fournisseur@gmail.com` | |
| Ville | `Douala` | |
| Pays | `Cameroun` | |
| Actif | coché | |

3. Cliquez sur **Créer**.

**Résultat attendu** : « TEST Quincaillerie du Wouri » apparaît dans la liste, type « Fournisseur ».

- [ ] **A3** — Organisation fournisseur créée.

### Scène A4 — L'organisation du sous-traitant

**Qui / Où** : idem A3.

**Méthode** : **Nouvelle organisation**, puis :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `TEST Électricité Akwa` | ★ |
| Type | « Sous-traitant » | ★ |
| E-mail | `votre.adresse+soustraitant@gmail.com` | |
| Ville | `Douala` | |
| Actif | coché | |

Cliquez sur **Créer**.

**Résultat attendu** : « TEST Électricité Akwa » apparaît, type « Sous-traitant ».

- [ ] **A4** — Organisation sous-traitant créée.

### Scène A5 — La fiche fournisseur de Martin

**Pourquoi** : le **carnet des fournisseurs** décrit à qui l'on achète, quoi et à quelles conditions. On le **relie à
l'organisation** de A3 : c'est ce lien qui permettra à Martin d'ouvrir son extranet.

**Qui** : le Gardien. **Où** : *Achats et logistique › Fournisseurs*.

**Méthode**

1. Cliquez sur **Nouveau fournisseur**. La fenêtre **Nouveau fournisseur** s'ouvre.
2. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Code | *(vide : attribué automatiquement, FRN-…)* | |
| Raison sociale | `TEST Quincaillerie du Wouri` | ★ |
| Ville | `Douala` | |
| Pays | `Cameroun` (déjà proposé) | |
| Catégories | `ciment` puis **Entrée**, `acier` puis **Entrée** | |
| Délai de paiement (jours) | `30` (proposé) | |
| Délai de livraison (jours) | `3` | |
| E-mail | `votre.adresse+fournisseur@gmail.com` | |
| Canal préféré | « E-mail » | |
| Organisation (accès extranet) | « TEST Quincaillerie du Wouri » | |

> Le **Canal préféré** « E-mail » est conseillé tant que WhatsApp n'est pas activé : les bons de commande partiront par
> e-mail. (Avec « WhatsApp » choisi mais WhatsApp non activé, la plateforme bascule d'elle-même sur l'e-mail.)

3. Cliquez sur **Créer**.

**Résultat attendu** : la fiche s'ouvre avec les onglets **Profil**, **Catalogue et tarifs**, **Commandes**,
**Documents**, **Performance**, **Incidents**, **Contacts** ; l'organisation est affichée dans le profil.

> Si vous choisissez par erreur une organisation déjà reliée à un autre fournisseur, la plateforme refuse : « Cette
> organisation est déjà reliée à une autre fiche ».

- [ ] **A5** — Fiche fournisseur créée et reliée à son organisation.

### Scène A6 — Le ciment entre au catalogue

**Qui** : le Gardien. **Où** : fiche « TEST Quincaillerie du Wouri », onglet **Catalogue et tarifs**.

**Méthode**

1. Cliquez sur **Nouveau produit**.
2. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Référence | `CIM-425` | ★ |
| Nom | `Ciment CPJ 42.5 sac 50 kg` | ★ |
| Catégorie | `ciment` | |
| Unité | `sac` | |
| Prix unitaire | `5200` | |
| Devise | `XAF` (proposée) | |
| Quantité minimum | `10` | |
| Délai de livraison (jours) | `3` | |
| Prix valable jusqu'au | une date dans 3 mois | |
| Actif | coché | |

3. Cliquez sur **Créer**.

**Résultat attendu** : le ciment apparaît dans le catalogue au prix de 5 200 FCFA.

- [ ] **A6** — Produit au catalogue.

### Scène A7 — La fiche sous-traitant de Sylvie

**Pourquoi** : même principe pour la sous-traitance. Son entreprise n'est pas encore « qualifiée » : ce sera fait au
chapitre 10.

**Qui** : le Gardien. **Où** : *Sous-traitance › Sous-traitants*, onglet **Sous-traitants**.

**Méthode**

1. Cliquez sur **Nouveau sous-traitant**.
2. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Raison sociale | `TEST Électricité Akwa` | ★ |
| Corps de métier | dans la famille « Lots techniques », cochez « Électricité » | |
| Zones | `Douala` puis **Entrée** | |
| E-mail | `votre.adresse+soustraitant@gmail.com` | |
| Ville | `Douala` | |
| Effectif | `8` | |
| Assurance RC jusqu'au | une date dans 1 an | |
| Organisation (accès extranet) | « TEST Électricité Akwa » | |

3. Cliquez sur **Créer**.

**Résultat attendu** : la fiche est créée au statut **Prospect** (en attente de qualification), reliée à son organisation.

- [ ] **A7** — Fiche sous-traitant créée.

### Scène A8 — L'équipe de gros œuvre

**Qui** : le Gardien. **Où** : *Administration › Utilisateurs et rôles*, onglet **Équipes**.

**Méthode**

1. Cliquez sur **Nouvelle équipe**.
2. Remplissez (le chef et les membres seront ajoutés à la scène A13, quand leurs comptes existeront) :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `TEST Équipe gros œuvre` | ★ |
| Métier | « Gros œuvre » | |
| Description | `Équipe de la Villa Mballa` | |
| Actif | coché | |

3. Cliquez sur **Créer**.

**Résultat attendu** : l'équipe apparaît dans la liste.

- [ ] **A8** — Équipe créée.

### Scène A9 — Les comptes du personnel

**Pourquoi** : chaque collègue reçoit une **invitation** par e-mail avec un lien personnel pour choisir lui-même son mot
de passe. Aucun mot de passe ne circule.

**Qui** : le Gardien. **Où** : *Administration › Utilisateurs et rôles*, onglet **Utilisateurs**.

**Méthode** — à faire **sept fois**, une par collègue (Grâce, Jordan, Samuel, Ernest, Linda, Rachel, Moussa) :

1. Cliquez sur **Nouvel utilisateur**. La fenêtre **Nouvel utilisateur** s'ouvre.
2. Remplissez les champs ci-dessous avec les valeurs de la ligne du collègue (tableau suivant).
3. Cliquez sur **Créer**.

| Champ (dans l'ordre de l'écran) | Valeur | |
| --- | --- | --- |
| E-mail | l'adresse du collègue | ★ |
| Prénom | le prénom | ★ |
| Nom | le nom en « TEST- » | ★ |
| Fonction | la fonction (tableau) | |
| Métier | le métier (tableau) ; sinon laissez « Non précisé » | |
| Organisation | *(vide)* — le personnel est rattaché automatiquement à l'entreprise | |
| Rôles | cochez le ou les rôles du tableau | ★ |
| Projets | *(vide)* — les projets seront attribués à la scène M2 | |
| Envoyer l'invitation | coché (déjà coché) | |
| Envoyer l'accès par | « E-mail » coché (déjà coché) | |

| Prénom | Nom | E-mail | Fonction | Métier | Rôles à cocher |
| --- | --- | --- | --- | --- | --- |
| `Grâce` | `TEST-EWANE` | `votre.adresse+direction@gmail.com` | `Directrice des opérations` | Non précisé | « Direction / Responsable » |
| `Jordan` | `TEST-NKENG` | `votre.adresse+commercial@gmail.com` | `Commercial` | Non précisé | « Commercial » |
| `Samuel` | `TEST-FOTSO` | `votre.adresse+chefprojet@gmail.com` | `Ingénieur chef de projet` | Non précisé | « Chef de projet / Conducteur de travaux » |
| `Ernest` | `TEST-TCHOUA` | `votre.adresse+chantier@gmail.com` | `Chef de chantier` | « Gros œuvre » | « Chef de chantier », « Magasinier », « Responsable QHSE » |
| `Linda` | `TEST-MBARGA` | `votre.adresse+achat@gmail.com` | `Acheteuse` | Non précisé | « Acheteur / Logistique » |
| `Rachel` | `TEST-NDONGO` | `votre.adresse+finance@gmail.com` | `Comptable` | Non précisé | « Finance / Comptabilité », « Ressources humaines » |
| `Moussa` | `TEST-BELLO` | `votre.adresse+technicien@gmail.com` | `Électricien` | « Électricité » | « Artisan / Technicien » |

**Résultat attendu**

- Les sept comptes apparaissent dans la liste, colonne **Statut** : **Invité**.
- L'onglet **Invitations** liste sept invitations en attente.
- Sept e-mails d'invitation arrivent dans Gmail (un par adresse « + »). **Ne les ouvrez pas encore.**

- [ ] **A9** — Les sept collègues sont invités.

### Scène A10 — Les comptes des partenaires

**Pourquoi** : Martin et Sylvie ne sont pas des employés : leur compte est rattaché à **leur organisation**, qui leur
ouvre l'extranet.

**Qui / Où** : idem A9.

**Méthode** : **Nouvel utilisateur**, deux fois :

| Champ | Martin | Sylvie | |
| --- | --- | --- | --- |
| E-mail | `votre.adresse+fournisseur@gmail.com` | `votre.adresse+soustraitant@gmail.com` | ★ |
| Prénom | `Martin` | `Sylvie` | ★ |
| Nom | `TEST-KAMGA` | `TEST-ABENA` | ★ |
| Fonction | `Gérant` | `Gérante` | |
| Organisation | « TEST Quincaillerie du Wouri » | « TEST Électricité Akwa » | ★ pour un partenaire |
| Rôles | « Fournisseur » | « Sous-traitant » | ★ |
| Envoyer l'invitation / par | coché, « E-mail » | coché, « E-mail » | |

Cliquez sur **Créer** à chaque fois.

**Résultat attendu** : deux invitations de plus (neuf en tout).

> **Contrôle** : essayez de créer un compte « Fournisseur » **sans** organisation. La plateforme refuse : « Choisissez
> l'organisation du compte (type « fournisseur ») ». Annulez.

- [ ] **A10** — Les deux partenaires sont invités.

### Scène A11 — L'invitation envoyée par erreur

**Pourquoi** : vérifier qu'une invitation peut être annulée, puis renvoyée.

**Qui** : le Gardien. **Où** : *Administration › Utilisateurs et rôles*, onglets **Utilisateurs** puis **Invitations**.

**Méthode**

1. **Nouvel utilisateur** : E-mail `votre.adresse+erreur@gmail.com`, Prénom `Erreur`, Nom `TEST-ERREUR`, Rôles « Artisan /
   Technicien », invitation par e-mail. **Créer**.

2. Onglet **Invitations** : sur cette invitation, cliquez sur **Révoquer** (effet immédiat, sans confirmation).
3. Dans Gmail, ouvrez l'e-mail reçu sur `+erreur` et cliquez sur son lien.
4. Revenez dans l'onglet **Invitations** : sur la ligne révoquée, cliquez sur **Renvoyer**. Dans la fenêtre **Renvoyer
   l'invitation**, laissez « E-mail » coché et cliquez sur **Renvoyer**.

5. Ouvrez le nouvel e-mail et son lien : la page d'activation s'affiche. **Fermez-la sans activer.**
6. Onglet **Utilisateurs** : cliquez sur ce compte (statut **Invité**) pour ouvrir sa fiche, cliquez sur **Désactiver**,
   puis confirmez dans la fenêtre **Désactiver le compte**.

**Résultat attendu**

- Étape 3 : le lien révoqué affiche un message « lien invalide ou expiré ».
- Étape 5 : le nouveau lien fonctionne ; l'ancien, non.
- Étape 6 : le compte passe à **Désactivé**.

- [ ] **A11** — Révocation, renvoi et désactivation fonctionnent.

### Scène A12 — Chacun active son compte

**Pourquoi** : chaque collègue choisit son mot de passe et pose sa double authentification.

**Qui** : tour à tour Grâce, Jordan, Samuel, Ernest, Linda, Rachel, Moussa, Martin et Sylvie, **chacun dans son profil
de navigateur**. **Où** : Gmail puis la page d'activation.

**Méthode** — pour chaque personnage :

1. Ouvrez la fenêtre Chrome de son profil (ex. **GLOBUS DIR** pour Grâce), puis Gmail, puis l'e-mail d'invitation
   adressé à son adresse « + » ; cliquez sur le lien.

2. Sur la page d'activation :

| Champ | Valeur | |
| --- | --- | --- |
| Prénom / Nom | déjà remplis : vérifiez-les | |
| Téléphone (WhatsApp) | facultatif | |
| Choisissez votre mot de passe | 12 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial (ex. `Villa-Mballa-2026!`) | ★ |
| Confirmez le mot de passe | le même | ★ |

3. Cliquez sur **Activer et continuer**. Notez le mot de passe de chaque personnage sur votre feuille.
4. **Double authentification** — obligatoire pour Grâce et Rachel, conseillée pour les autres :
   1. Ouvrez **Mon compte** (votre nom en haut à droite), onglet **Sécurité**.
   2. Cliquez sur **Configurer une application d'authentification** : un QR code s'affiche.
   3. Dans l'application du téléphone, touchez **+** › **Scanner un code QR** et visez l'écran. Renommez la ligne avec le
      nom du personnage.
   4. Tapez le code affiché par l'application dans **Code à 6 chiffres**, cliquez sur **Activer**.
   5. Cliquez sur **Télécharger** pour garder les codes de secours, puis sur **J'ai conservé mes codes**.

**Résultat attendu**

- Chaque employé arrive dans l'ERP avec **un menu réduit à son métier** (Ernest ne voit pas la Finance ; Rachel ne voit
  pas le Hub BIM).
- Martin et Sylvie arrivent dans l'**extranet**.
- Chez Grâce et Rachel, le bandeau « La double authentification est obligatoire pour votre profil » disparaît une fois
  la double authentification activée.
- Côté Gardien, *Administration › Sécurité*, onglet **Synthèse**, bloc **MFA à activer** : Grâce et Rachel n'y figurent
  plus.

- [ ] **A12** — Les neuf comptes sont activés ; MFA en place au moins pour Grâce et Rachel.

### Scène A13 — L'équipe trouve son chef

**Qui** : le Gardien. **Où** : *Utilisateurs et rôles*, onglet **Équipes**.

**Méthode**

1. Cliquez sur l'équipe « TEST Équipe gros œuvre » : sa fiche s'ouvre. Cliquez sur **Modifier**.
2. Remplissez :

| Champ | Valeur |
| --- | --- |
| Chef d'équipe | « Ernest TEST-TCHOUA » |
| Membres | « Ernest TEST-TCHOUA » et « Moussa TEST-BELLO » |

3. Cliquez sur **Enregistrer**.

**Résultat attendu** : la fiche affiche le chef et les membres **par leur nom**.

- [ ] **A13** — Équipe complète.

---

# Livre III — La rencontre

## Chapitre 4 — Le site vitrine

*Un dimanche soir, Paul Mballa, qui vient d'acheter un terrain à Bonamoussadi, cherche « construction villa Douala » et
arrive sur le site de GLOBUS ENGINEERING.*

Pour tout ce chapitre, vous êtes un **visiteur anonyme** : profil **Visiteur** de Chrome sur l'ordinateur. Refaites
aussi les scènes V1 à V4 **sur un téléphone** : la plupart des vrais visiteurs viendront de là.

### Scène V1 — Le bandeau des cookies

**Pourquoi** : la loi impose de demander l'accord du visiteur avant toute mesure d'audience ; son choix doit être
respecté et modifiable.

**Qui** : le Visiteur. **Où** : `https://globus-engineering-sarl.com`.

**Méthode**

1. Ouvrez la page d'accueil. Le bandeau des cookies apparaît en bas.
2. Cliquez sur **Personnaliser** : deux réglages s'affichent, **Mesure d'audience** et **Marketing**.
3. Laissez **Mesure d'audience** coupé et **Marketing** coupé, cliquez sur **Enregistrer mes choix**.
4. Actualisez la page (touche **F5**).
5. Tout en bas de la page, cliquez sur **Gérer les cookies**.

**Résultat attendu** : après F5, le bandeau ne revient pas ; **Gérer les cookies** le fait réapparaître avec vos choix.
Les boutons **Tout refuser** et **Tout accepter** existent aussi.

- [ ] **V1** — Le choix des cookies est respecté et modifiable.

### Scène V2 — La visite de toutes les pages

**Pourquoi** : un lien cassé ou une image absente fait fuir un prospect.

**Qui** : le Visiteur, sur ordinateur **et** téléphone. **Où** : tout le site.

**Méthode**

1. Cliquez sur chaque entrée du menu du haut, et sur chaque entrée de ses sous-menus.
2. Sur téléphone, ouvrez le menu **☰** et parcourez-le de la même façon.
3. Cliquez sur les boutons de l'en-tête (**Décrire mon projet**, **Contact**…) sans remplir les formulaires.
4. Dans le pied de page, cliquez sur chaque lien (colonnes, services, liens légaux).

**Résultat attendu** : aucune page « introuvable », aucune image cassée, tout en français ; sur téléphone rien ne déborde.

- [ ] **V2** — Navigation impeccable sur ordinateur et téléphone.

### Scène V3 — La recherche du site

**Méthode** : cliquez sur la **loupe** en haut ; tapez `villa`, validez ; recommencez avec `devis`.

**Résultat attendu** : des résultats pertinents (pages, offres, articles, questions fréquentes) avec le mot surligné.

- [ ] **V3** — La recherche fonctionne.

### Scène V4 — Les contenus

**Méthode** : ouvrez une offre, une expertise, un service, une réalisation, un article de blog, la page **FAQ** et le
centre d'aide.

**Résultat attendu** : chaque page s'affiche avec texte et images ; les contenus « mis en avant » apparaissent sur
l'accueil.

- [ ] **V4** — Les contenus s'affichent.

### Scène V5 — « Décrire mon projet » : Paul devient un prospect

**Pourquoi** : c'est la porte d'entrée commerciale. La demande crée un **lead** (prospect) dans le CRM, affecté
automatiquement à un commercial.

**Qui** : le Visiteur (Paul). **Où** : bouton **Décrire mon projet** (en-tête du site).

**Méthode** — le formulaire a **quatre étapes** (« Votre univers », « Votre projet », « Budget et délai », « Vos
coordonnées ») ; passez de l'une à l'autre avec **Continuer** :

1. **Votre univers** : cliquez sur la carte de l'univers de la maison individuelle (« Globus Home » ou équivalent).
   **Continuer**.

2. **Votre projet** :

| Champ | Valeur | |
| --- | --- | --- |
| Type de projet | « maison individuelle » | ★ |
| Localisation du projet (ville, quartier) | `Bonamoussadi, Douala` | |
| Disposez-vous d'un terrain ? | « Oui » | |
| Statut du terrain | « Titre foncier » | |
| Surface du terrain (m²) | `500` | |
| Surface à construire (m²) | `180` | |
| Nombre de niveaux | `2` | |
| Nombre de pièces | `6` | |
| Standing | « Confort » | |

   **Continuer**.

3. **Budget et délai** :

| Champ | Valeur |
| --- | --- |
| Budget minimum | `20000000` |
| Budget maximum | `30000000` (doit être supérieur au minimum) |
| Devise | « FCFA (XAF) » |
| Délai souhaité | « Sous 3 mois » |
| Financement | « Fonds propres » |
| Décrivez votre projet en quelques mots | `Villa familiale R+1, 4 chambres, terrain titré.` |

   Cochez éventuellement des priorités et des services. **Continuer**.

4. **Vos coordonnées** :

| Champ | Valeur | |
| --- | --- | --- |
| Prénom | `Paul` | ★ |
| Nom | `TEST-MBALLA` | |
| E-mail | `votre.adresse+client@gmail.com` | au moins un moyen de contact |
| Téléphone | un numéro (ex. `690000000`) | |
| Pays de résidence | `Cameroun` | |
| Ville | `Douala` | |
| Canal de contact préféré | « E-mail » | |
| Case « J'accepte que GLOBUS ENGINEERING traite mes données pour répondre à ma demande. » | cochée | ★ |

5. Cliquez sur **Envoyer ma demande**.

**Résultat attendu**

- Un message de confirmation s'affiche, avec une estimation indicative.
- Un e-mail d'accusé de réception arrive sur l'adresse `+client`.
- (Côté ERP, chapitre 5 : un lead « Paul TEST-MBALLA » existe, affecté à un commercial.)

> Si vous oubliez le prénom ou les moyens de contact, l'étape refuse de continuer avec un message clair (« Indiquez au
> moins un moyen de vous joindre »).

- [ ] **V5** — La demande de Paul est envoyée et accusée.

### Scène V6 — L'estimation instantanée

**Pourquoi** : une estimation de prix immédiate à partir d'une photo, d'un croquis ou d'une description.

**Qui** : le Visiteur (Paul). **Où** : page **Estimation instantanée** du site.

**Méthode**

1. Déposez une photo de terrain (zone de dépôt des images). Dans le bloc **Note vocale (facultatif)**, cliquez sur
   **Enregistrer** (autorisez le micro), dites `Je voudrais une grande terrasse couverte`, puis **Arrêter** : un
   lecteur permet de réécouter la note (la corbeille la supprime).

2. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Univers | « Maison (Home) » | |
| Surface habitable (m²) | `180` | |
| Niveaux | `2` | |
| Standing | « Confort » | |
| Localisation du terrain | `Bonamoussadi` | |
| Votre projet en quelques mots | `Villa R+1 4 chambres` | |
| Prénom | `Paul` | ★ |
| Nom | `TEST-MBALLA` | |
| Ville de résidence | `Douala` | |
| E-mail | `votre.adresse+client@gmail.com` | |
| Case « J'accepte que GLOBUS ENGINEERING analyse mes éléments et me recontacte… » | cochée | ★ |

3. Cliquez sur **Obtenir mon estimation**.

**Résultat attendu** : une fourchette de prix s'affiche. **Si l'IA n'est pas activée**, l'analyse de la photo n'est pas
faite mais l'estimation par surface et standing s'affiche quand même : ce n'est pas une anomalie.
Le bloc « **Note vocale reçue et transmise à l'ingénieur** » confirme la prise en compte de la note, avec la phrase
comprise lorsqu'elle a été transcrite. Sur iPhone comme sur Android, la note est acceptée : le message « Extension
incohérente avec le contenu du fichier » ne doit plus jamais apparaître.

- [ ] **V6** — L'estimation est obtenue ; la demande et la note vocale sont enregistrées.

### Scène V7 — Le formulaire de contact

**Qui** : un autre visiteur. **Où** : page **Contact**.

**Méthode** — remplissez le formulaire « Écrivez-nous » :

| Champ | Valeur | |
| --- | --- | --- |
| Prénom | `Claire` | ★ |
| Nom | `TEST-CONTACT` | ★ |
| E-mail | `votre.adresse+contact@gmail.com` | ★ |
| Téléphone / WhatsApp | *(vide)* | |
| Objet | `Demande de renseignements` | ★ |
| Message | `Bonjour, faites-vous des extensions ?` | ★ |
| Case « J'accepte que GLOBUS ENGINEERING traite mes données… » | cochée | ★ |

Cliquez sur le bouton d'envoi.

**Résultat attendu** : message de succès ; un e-mail d'accusé de réception arrive sur `+contact`.

- [ ] **V7** — Le formulaire de contact fonctionne.

### Scène V8 — L'abonnement à la lettre d'information

**Pourquoi** : l'inscription se fait en **double consentement** (confirmation par e-mail).

**Méthode**

1. Dans le pied de page, bloc lettre d'information : tapez `votre.adresse+news@gmail.com`, cochez « J'accepte de recevoir
   la newsletter… », cliquez sur **S'inscrire**.

2. Ouvrez l'e-mail de confirmation reçu sur `+news` et cliquez sur son lien.

**Résultat attendu** : message « Vérifiez votre boîte e-mail… », puis la page de confirmation après le clic. (Sans la
case cochée, le message « Merci de cocher la case de consentement » s'affiche.)

- [ ] **V8** — Abonnement confirmé par e-mail.

### Scène V9 — L'assistant du site

**Méthode**

1. Cliquez sur la bulle de discussion en bas à droite.
2. Écrivez `Combien coûte une villa de 150 m² ?` et envoyez.
3. Si l'assistant propose de laisser vos coordonnées, faites-le (adresse `+client`).

**Résultat attendu** : une réponse cohérente. **Si l'IA n'est pas activée**, l'assistant répond à partir de réponses
préparées et propose d'être recontacté : c'est normal. La conversation sera retrouvée par Jordan (scène C10).

- [ ] **V9** — L'assistant répond.

### Scène V10 — Un commentaire sous un article

**Méthode** : ouvrez un article du blog ; en bas, remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `Paul` | ★ |
| E-mail (non publié) | `votre.adresse+client@gmail.com` | |
| Votre commentaire | `Article très utile, merci !` | ★ |

Cliquez sur **Publier**.

**Résultat attendu** : « Merci ! Votre commentaire sera publié après modération. » (Modération : scène W1.)

- [ ] **V10** — Commentaire en attente de modération.

### Scène V11 — Les pages légales

**Méthode** : ouvrez, depuis le pied de page, les mentions légales, la politique de confidentialité, la politique cookies
et les conditions générales.

**Résultat attendu** : chaque page a un vrai contenu, avec les coordonnées exactes de l'entreprise.

- [ ] **V11** — Pages légales complètes.

---

## Chapitre 5 — Du prospect aux études

*Lundi matin, Jordan Nkeng ouvre l'ERP. Un certain Paul, à Douala, rêve d'une villa. Commence le travail du commercial,
du premier appel jusqu'au lancement des études : chez GLOBUS, on conçoit d'abord (plans, 3D, options),
le client valide, et seulement ensuite vient le devis des travaux.*

### Scène C1 — La règle qui distribue les prospects

**Pourquoi** : aucun prospect ne doit rester sans commercial. Une **règle d'affectation** envoie automatiquement les
prospects de Douala à Jordan.

**Qui** : le Gardien. **Où** : *Commercial › CRM*, onglet **Réglages**.

**Méthode**

1. Dans le bloc **Règles d'affectation des leads**, cliquez sur **Nouvelle règle**.
2. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `TEST Douala` | ★ |
| Priorité | `1` | |
| Critères › Villes | `Douala` puis **Entrée** (laissez les autres critères vides : « Indifférent ») | |
| Commerciaux | « Jordan TEST-NKENG » | |
| Stratégie | « Tour de rôle » | |
| Actif | coché | |

3. Cliquez sur **Créer**.

**Résultat attendu** : la règle apparaît, active.

> La demande de Paul (V5) est peut-être arrivée **avant** cette règle et a pu être confiée à un autre commercial. À la
> scène C2, vous la confierez à Jordan avec le bouton **Affecter**.

- [ ] **C1** — Règle d'affectation en place.

### Scène C2 — Le prospect arrive chez Jordan

**Qui** : Jordan (profil **GLOBUS COM**). **Où** : *Commercial › CRM*, onglet **Leads**.

**Méthode**

1. Ouvrez l'onglet **Leads** ; regardez la cloche des notifications en haut à droite.
2. Si le lead de Paul (V5) n'est pas affecté à Jordan : ouvrez-le (profil du Gardien), cliquez sur **Affecter**, choisissez
   **Commercial** « Jordan TEST-NKENG », **Enregistrer**.

**Résultat attendu** : les demandes de Paul (V5, V6) apparaissent avec leur source, leur univers, leur score et leur
« température » ; un compte à rebours indique le délai de première réponse ; la cloche de Jordan signale un nouveau
lead.

- [ ] **C2** — Le prospect est chez Jordan.

### Scène C3 — Le dossier de Paul

**Qui** : Jordan. **Où** : fiche du lead de la scène V5 (cliquez sur sa ligne).

**Résultat attendu** : le bloc du dossier « Décrire mon projet » reprend toutes les réponses de Paul (type de projet,
terrain, surfaces, budget…) avec un taux de complétude ; le score est expliqué. Sur le lead de l'estimation (V6),
le bloc **Estimation instantanée** montre la photo, la **note vocale** (lecture) et sa transcription.

- [ ] **C3** — Dossier complet.

### Scène C4 — Le premier appel et la relance

**Pourquoi** : la première activité enregistrée **arrête le chronomètre** de réponse et fait passer le lead à
« Contacté ».

**Qui** : Jordan. **Où** : fiche du lead, bloc **Activités**.

**Méthode** — deux activités :

1. Cliquez sur **Activité**. Fenêtre **Nouvelle activité** — l'appel qui vient d'avoir lieu :

| Champ | Valeur | |
| --- | --- | --- |
| Type | « Appel » | ★ |
| Objet | `Premier échange, RDV terrain` | ★ |
| Contenu | `Paul confirme budget et terrain titré.` | |
| Fait | coché | |
| Sens | « Sortant » | |
| Résultat | `RDV terrain jeudi` | |

   **Enregistrer**.

2. Cliquez de nouveau sur **Activité** — la relance à faire :

| Champ | Valeur | |
| --- | --- | --- |
| Type | « Relance » | ★ |
| Objet | `Rappeler Paul après la visite` | ★ |
| Échéance | dans deux jours, 10:00 | |
| Fait | **non** coché | |

   **Enregistrer**.

**Résultat attendu** : les deux activités figurent dans le fil ; le chronomètre de réponse est arrêté ; le statut du lead
devient **Contacté**.

- [ ] **C4** — Premier contact enregistré, relance planifiée.

### Scène C5 — Qualifier le projet

**Qui** : Jordan. **Où** : fiche du lead.

**Méthode**

1. Cliquez sur **Qualifier**. La fenêtre **Qualification du lead** permet aussi de corriger les coordonnées.
2. Complétez :

| Champ | Valeur |
| --- | --- |
| WhatsApp | le numéro de Paul (même que le téléphone) |
| Univers | « Globus Home » |
| Offre visée | une offre de la liste (ex. « Maison clé en main ») |
| Budget maximum | `25000000` |
| Délai souhaité | « Sous 3 mois » |
| Étiquettes | `décisionnaire` puis **Entrée** |

3. **Enregistrer**.
4. Cliquez sur **Statut**. Fenêtre **Statut du lead** : **Statut** « Qualifié ». **Enregistrer**.

**Résultat attendu** : la fiche affiche les nouvelles informations ; statut **Qualifié**.

> **Contrôle du champ conditionnel** : dans **Statut**, choisissez « Perdu » : le champ **Motif de perte** apparaît,
> obligatoire. Revenez sur « Qualifié » : il disparaît.

- [ ] **C5** — Prospect qualifié.

### Scène C6 — Du prospect à l'opportunité

**Pourquoi** : l'affaire entre dans le **pipeline** ; un contact et une organisation cliente sont créés pour Paul.

**Qui** : Jordan. **Où** : fiche du lead.

**Méthode**

1. Cliquez sur **Convertir en opportunité**. Remplissez :

| Champ | Valeur |
| --- | --- |
| Titre | proposé (modifiable) |
| Montant estimé | `25000000` |
| Étape | « Découverte » |
| Date de décision attendue | dans 15 jours |
| Créer l'organisation | coché |

2. **Enregistrer**, puis cliquez sur **Voir le pipeline**.

**Résultat attendu** : une carte au nom de Paul dans la colonne « Découverte » de l'onglet **Pipeline** ; dans l'onglet
**Contacts**, « Paul TEST-MBALLA » et une organisation cliente ; le lead passe à **Converti**.

- [ ] **C6** — Opportunité créée.

### Scène C7 — L'affaire avance d'une étape

**Qui** : Jordan. **Où** : *Commercial › CRM*, onglet **Pipeline**.

**Méthode** : sur la carte de Paul, dans la **liste d'étape** de la carte, choisissez « Proposition ». Actualisez la page.

**Résultat attendu** : la carte passe dans la colonne « Proposition » et y reste après actualisation.

> Choisir « Perdu » ouvre une fenêtre demandant le motif : ne le faites pas ici.

- [ ] **C7** — Le pipeline se met à jour.

### Scène C8 — Démarrer les études

**Pourquoi** : chez GLOBUS, la conception passe avant tout devis de travaux. Le projet naît au statut « Étude », Paul
reçoit son espace client pour suivre et **valider** plans, 3D et options ; les études lui seront facturées après sa
validation, et le devis des travaux viendra ensuite, sur ce même projet (chapitre 8).

**Qui** : Jordan. **Où** : *Commercial › CRM*, onglet **Pipeline**, carte de Paul, bouton **Études**.

**Méthode**

1. Sur la carte de Paul, cliquez sur **Études** : fenêtre **Démarrer les études**.

| Champ | Valeur | |
| --- | --- | --- |
| Nom du projet | `TEST — Villa Mballa` | |
| Chef de projet | « Samuel TEST-FOTSO » | |
| E-mail du client | *(vide : le contact de l'opportunité, `votre.adresse+client@gmail.com`, est invité)* | |

2. Cliquez sur **Démarrer les études** : la fiche du projet s'ouvre.

**Résultat attendu**

- Le projet a un code de la forme **PRJ-AAAA-NNNNN**, au statut **Étude**, sans montant de contrat ; Samuel est membre.
- La carte de Paul dans le pipeline affiche maintenant **Projet** (au lieu d'**Études**).
- **Paul reçoit un e-mail d'invitation** à l'espace client sur `+client` (il l'activera au chapitre 6).

> **Contrôle** : cliquez de nouveau sur **Projet** depuis la carte : c'est le même projet (aucun doublon n'est créé).

- [ ] **C8** — Études démarrées, projet créé, Paul invité, sans devis.

### Scène C9 — La relance

**Qui** : Jordan. **Où** : *CRM*, onglet **Activités**.

**Méthode** : sur la relance « Rappeler Paul après la visite » (C4), cliquez sur **Marquer faite** ; dans **Résultat**,
tapez `Devis accepté` ; confirmez.

**Résultat attendu** : la relance passe à « Fait ».

- [ ] **C9** — Relance close.

### Scène C10 — La conversation de l'assistant

**Qui** : Jordan. **Où** : *Commercial › Assistant et WhatsApp*.

**Méthode** : onglet **Site web** ; ouvrez la conversation de la scène V9, puis une conversation plus ancienne, puis
revenez à celle de V9 ; lisez-la, puis cliquez sur **Clore**.

**Résultat attendu** : chaque conversation s'ouvre à droite, sans page d'erreur, lisible en entier ; après **Clore**,
elle porte le statut **Close**.

- [ ] **C10** — Conversations consultables et clôturables.

---

## Chapitre 6 — L'espace client de Paul

*Paul reçoit l'e-mail « Votre espace client est prêt ». Derrière ce lien, il verra sa maison naître.*

### Scène K1 — L'activation

**Qui** : Paul (profil **GLOBUS CLI**). **Où** : l'e-mail d'invitation reçu sur `+client`.

**Méthode**

1. Ouvrez l'e-mail d'invitation et cliquez sur son lien.
2. Page d'activation :

| Champ | Valeur | |
| --- | --- | --- |
| Prénom / Nom | déjà remplis (`Paul`, `TEST-MBALLA`) : vérifiez | |
| Téléphone (WhatsApp) | facultatif | |
| Choisissez votre mot de passe | 12 caractères minimum (majuscule, minuscule, chiffre, caractère spécial) | ★ |
| Confirmez le mot de passe | le même | ★ |

3. Cliquez sur **Activer et continuer**. Notez le mot de passe.

**Résultat attendu** : Paul arrive dans son espace client, sur la page **Mon compte** : la double authentification lui
est demandée (elle est **obligatoire pour un client**).

- [ ] **K1** — Compte de Paul activé.

### Scène K2 — La double authentification de Paul

**Pourquoi** : l'espace client permet de valider des décisions et de payer : la plateforme refuse d'aller plus loin tant
que la double authentification n'est pas posée.

**Qui** : Paul. **Où** : **Mon compte**, onglet **Sécurité**.

**Méthode**

1. Cliquez sur **Configurer une application d'authentification**.
2. Scannez le QR code avec l'application du téléphone (renommez la ligne « Paul »), tapez le code dans **Code à 6
   chiffres**, cliquez sur **Activer**.

3. **Télécharger** les codes de secours, puis **J'ai conservé mes codes**.

**Résultat attendu** : le reste de l'espace client devient accessible.

- [ ] **K2** — Double authentification du client active.

### Scène K3 — Se déconnecter et revenir

**Méthode**

1. Cliquez sur le nom en haut à droite, puis déconnectez-vous.
2. Sur la page de connexion : **Adresse e-mail**, **Mot de passe**, cochez **Rester connecté**, cliquez sur **Se
   connecter**.

3. Tapez le code dans **Code de l'application d'authentification**, cochez **Faire confiance à cet appareil pendant 30
   jours**, cliquez sur **Vérifier**.

**Résultat attendu** : connexion réussie ; à la prochaine connexion depuis ce navigateur, le code ne sera plus demandé
pendant 30 jours.

- [ ] **K3** — Déconnexion et reconnexion fonctionnent.

### Scène K4 — Le tableau de bord de Paul

**Qui** : Paul. **Où** : menu **Tableau de bord**.

**Résultat attendu**

- Le code et le nom du projet « TEST — Villa Mballa ».
- Le **Montant du contrat (avenants non inclus)** (25 000 000 HT + TVA) et, à part, **Avenants approuvés** à 0 FCFA.
- La frise des jalons de paiement (30 %, 40 %, 30 %).
- Aucun montant payé pour l'instant.
- **Aucune donnée d'un autre client.**

- [ ] **K4** — Tableau de bord juste, limité au projet de Paul.

### Scène K5 — La visite de toutes les pages

**Méthode** : cliquez une à une sur les entrées du menu : **Passeport projet**, **Chantier**, **Planning**,
**Finances**, **Documents**, **Preuves certifiées**, **Validations**, **Maquette 3D / BIM**, **Configurateur**, **Live,
360° et drone**, **Messagerie**, **Appels**, **Mon bâtiment**, **Énergie et confort**, **SAV et garanties**, **Dossier
Tranquillité**, **Mon avis**, **Notifications**, **Mon compte**, **Documentation**.

**Résultat attendu**

- Chaque page s'ouvre sans erreur ; une page encore vide l'explique (« Aucun document publié »…).
- **Financement** et **Parrainage** n'apparaissent pas tant que ces programmes ne sont pas ouverts (chapitre 12).

- [ ] **K5** — Toutes les pages de l'espace client s'ouvrent.

### Scène K6 — L'application GLOBUS Client

**Qui** : Paul. **Où** : téléphone, application **GLOBUS Client**.

**Méthode**

1. Ouvrez l'application ; saisissez l'e-mail et le mot de passe de Paul, cochez **Rester connecté**, touchez **Se
   connecter**, puis tapez le code à 6 chiffres et touchez **Vérifier**.

2. Parcourez les onglets du bas : **Accueil**, **Chantier**, **Finances**, **Messages**, **Plus**.
3. **Plus** › **Mon compte**, onglet **Notifications** : touchez **Activer le push**, acceptez les notifications du
   téléphone, puis touchez **Envoyer une notification de test**.

**Résultat attendu** : les mêmes informations que sur l'ordinateur ; la notification de test apparaît sur le téléphone.

- [ ] **K6** — Application client fonctionnelle, notifications reçues.

---

# Livre IV — Le chantier se prépare

## Chapitre 7 — Samuel monte le projet et les études

*La Villa Mballa est désormais le projet de Samuel, encore au stade des **études** : plans, 3D et options seront
conçus, validés par Paul, facturés et remis avant tout devis de travaux (scènes E1 à E5, en fin de chapitre). Tout se passe dans la **fiche du projet** : menu *Projets ›
Chantiers*, ligne « TEST — Villa Mballa ». La fiche a des onglets en haut : **Synthèse**, **Confiance et preuves**,
**Planning**, **Sites, phases, lots**, **Jalons**, **Équipe**, **Journal de chantier**, **Photos et vidéos**,
**Études et livrables**, **Décisions**, **Avenants**, **Budget**, **Risques**, **Tranquillité**, **Garanties**, **Immersion et digests**,
**Panneau connecté**.*

### Scène M1 — La carte d'identité du projet

**Qui** : Samuel (profil **GLOBUS CDP**). **Où** : fiche du projet, onglet **Synthèse**, bloc **Informations**.

**Méthode**

1. Cliquez sur **Modifier** : fenêtre **Modifier le projet**.
2. Complétez (le nom et le client sont repris de l'opportunité) :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `TEST — Villa Mballa` (déjà rempli) | ★ |
| Univers | « Globus Home » | |
| Offre | l'offre de l'opportunité (liste) | |
| Type de projet | « Construction neuve » | |
| Statut | « Étude » (laissez-le : il passera à « Préparation » au chapitre 8) | |
| Adresse | `Bonamoussadi, rue des Manguiers` | |
| Ville | `Douala` | |
| Latitude / Longitude | les coordonnées du terrain (*voir l'astuce*) | |
| Surface (m²) | `180` | |
| Niveaux | `2` | |
| Début prévu / Fin prévue | dans 15 jours / dans 9 mois | |
| Responsable | « Samuel TEST-FOTSO » | |
| Directeur de projet | « Grâce TEST-EWANE » | |
| Visible par le client | coché | |

> **Astuce coordonnées** : sur le téléphone, ouvrez Google Maps, appuyez longuement sur l'endroit voulu : la latitude et
> la longitude s'affichent (ex. `4.0920` et `9.7440`). Pour pouvoir **tester le pointage** (chapitre 11) sans aller à
> Bonamoussadi, mettez les coordonnées de l'endroit où vous jouez la recette.

3. Cliquez sur **Enregistrer**.

**Résultat attendu** : « Projet mis à jour » ; les informations et les indicateurs (budget, engagé, facturé…)
s'affichent.

- [ ] **M1** — Fiche projet complète.

### Scène M2 — L'équipe du projet

**Pourquoi** : Samuel, Ernest et Moussa ne voient **que** les projets dont ils sont membres. Rachel, Linda et Grâce voient
tous les projets, mais on les ajoute pour qu'elles reçoivent les notifications du projet.

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Équipe**.

> **Attention, deux écrans différents.** L'équipe **du projet** se gère dans la fiche du projet (onglet **Équipe**,
> bouton **Ajouter un membre**). L'onglet **Équipes** de *Administration › Utilisateurs et rôles* sert à autre chose :
> les équipes de métier (scène A8), sans bouton « Ajouter un membre ».

**Méthode** — cliquez sur **Ajouter un membre** pour chaque ligne, remplissez, **Enregistrer** :

| Utilisateur ★ | Rôle sur le projet | Accès aux finances |
| --- | --- | --- |
| « Ernest TEST-TCHOUA » | « Chef de chantier » | non |
| « Moussa TEST-BELLO » | « Membre » | non |
| « Linda TEST-MBARGA » | « Acheteur » | non |
| « Rachel TEST-NDONGO » | « Comptable » | **oui** |

(Laissez **Lots**, **Disciplines** et **Chantiers** vides : accès à tout le projet.)

**Résultat attendu** : les quatre membres (plus Samuel) sont listés. Dans la fenêtre d'Ernest (**GLOBUS CDC**),
*Projets › Chantiers* affiche maintenant « TEST — Villa Mballa ».

- [ ] **M2** — Équipe formée.

### Scène M3 — Le site et son périmètre de pointage

**Pourquoi** : le **site** est l'endroit physique du chantier. Son **rayon de géorepérage** est le cercle à l'intérieur
duquel les ouvriers peuvent pointer avec leur téléphone.

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Sites, phases, lots**.

**Méthode** : cliquez sur **Nouveau site**, remplissez, **Créer** :

| Champ | Valeur | |
| --- | --- | --- |
| Code | `S1-MBALLA` | ★ |
| Nom | `Parcelle Bonamoussadi` | ★ |
| Ville | `Douala` | |
| Latitude / Longitude | les mêmes qu'en M1 | |
| Rayon de géorepérage (m) | `150` | |
| Chef de chantier | « Ernest TEST-TCHOUA » | |
| Statut | « Préparation » | |
| Date de début | dans 15 jours | |
| Instructions d'accès | `Portail bleu, demander le gardien` | |
| Notes sécurité | `Casque obligatoire` | |

**Résultat attendu** : le site apparaît. (Le **Code** doit être unique sur toute la plateforme.)

- [ ] **M3** — Site créé avec son périmètre.

### Scène M4 — Lots et phases

**Pourquoi** : les **lots** découpent les travaux par métier (gros œuvre, électricité…) ; les **phases** par étape dans
le temps (fondations, élévation…).

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Sites, phases, lots**.

**Méthode**

1. **Nouveau lot**, pour chaque ligne, **Créer** (le devis des travaux du chapitre 8 réutilisera ces lots) :

| Code ★ | Nom ★ | Discipline | Statut |
| --- | --- | --- | --- |
| `ET` | `Études techniques` | *(vide)* | « Planifié » |
| `GO` | `Gros œuvre` | *(vide)* | « Planifié » |
| `SO` | `Second œuvre` | *(vide)* | « Planifié » |
| `ELEC` | `Électricité` | « Électricité » | « Planifié » |

2. **Nouvelle phase**, deux fois, **Créer** :

| Champ | Phase 1 | Phase 2 | |
| --- | --- | --- | --- |
| Nom | `Fondations` | `Élévation` | ★ |
| Ordre | `1` | `2` | |
| Début prévu / Fin prévue | dans 15 j / dans 45 j | dans 45 j / dans 4 mois | |
| Statut | « Planifié » | « Planifié » | |
| Couleur | une couleur (sélecteur) | une autre | |
| Visible par le client | coché | coché | |

**Résultat attendu** : les quatre lots et les deux phases apparaissent.

- [ ] **M4** — Structure du projet en place.

### Scène M5 — Les jalons

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Jalons**.

**Méthode**

1. **Nouveau jalon**, **Créer** (les trois jalons de paiement des travaux arriveront avec le contrat, scène B7) :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `Implantation` | ★ |
| Date d'échéance | dans 20 jours | ★ |
| Statut | « Planifié » | |
| Visible par le client | coché | |
| Part de paiement (%) | *(vide)* | |

**Résultat attendu** : le jalon « Implantation » apparaît, visible du client.

- [ ] **M5** — Jalons corrects.

### Scène M6 — Le planning

**Pourquoi** : enchaîner les tâches, calculer les dates (méthode du chemin critique) et figer la référence promise au
client.

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Planning**.

**Méthode**

1. Cliquez quatre fois sur **Nouvelle tâche** :

| Titre ★ | Phase | Lot | Chantier | Début prévu | Durée (jours) | Visible par le client |
| --- | --- | --- | --- | --- | --- | --- |
| `Implantation` | Fondations | GO | Parcelle Bonamoussadi | dans 15 j | `3` | coché |
| `Terrassement` | Fondations | GO | Parcelle Bonamoussadi | dans 18 j | `7` | non |
| `Fondations` | Fondations | GO | Parcelle Bonamoussadi | dans 25 j | `15` | coché |
| `Élévation murs` | Élévation | GO | Parcelle Bonamoussadi | dans 40 j | `30` | non |

   Laissez **Statut** « À faire » et **Priorité** « Normale ». **Créer** à chaque fois.

2. Cliquez sur **Dépendance** trois fois (fenêtre **Ajouter une dépendance**) :

| Tâche prédécesseur ★ | Tâche successeur ★ | Type | Décalage (jours) |
| --- | --- | --- | --- |
| Implantation | Terrassement | « Fin → Début » | `0` |
| Terrassement | Fondations | « Fin → Début » | `0` |
| Fondations | Élévation murs | « Fin → Début » | `0` |

3. Cliquez sur **Ordonnancer (CPM)**.
4. Cliquez sur **Figer une référence** : **Nom** ★ `Contrat`, **Motif** `Planning contractuel`, **Enregistrer**.

**Résultat attendu**

- Le **Diagramme de Gantt** enchaîne les barres ; le **chemin critique** est en rouge.
- La référence « Contrat » apparaît dans **Références de planning (baselines)**.

- [ ] **M6** — Planning construit et figé.

### Scène M7 — L'analyse des aléas du planning

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Planning**, bloc d'analyse des 30 prochains jours (pluie, livraisons, absences).

**Méthode** : cliquez sur **Analyser maintenant**. Si un risque apparaît, cliquez sur **Écarter**, indiquez un motif,
confirmez avec **Écarter**.

**Résultat attendu** : l'analyse s'exécute ; elle affiche des risques ou « Aucun risque détecté ». (La météo n'est
analysée que si le service météo est activé.)

- [ ] **M7** — Analyse des aléas fonctionnelle.

### Scène M9 — Le plan du rez-de-chaussée (GED)

**Pourquoi** : un plan suit un circuit : dépôt, revue, validation, publication « bon pour exécution », puis nouvelle
version qui rend l'ancienne périmée.

**Qui** : Samuel, puis Grâce. **Où** : *Projets › GED*.

**Méthode**

1. Samuel : choisissez le projet en haut à gauche, cliquez sur **Déposer un document** :

| Champ | Valeur | |
| --- | --- | --- |
| Fichier | le PDF « Plan RDC » (zone de dépôt) | ★ |
| Titre | `Plan RDC` | ★ |
| Type | « Plan » | ★ |
| Discipline | « Architecture » | |
| Confidentialité | « Interne » | ★ |
| Code | *(vide : attribué automatiquement)* | |
| Projet | « TEST — Villa Mballa » | |
| Lot | « GO » | |

   Cliquez sur **Déposer** : la fiche du document s'ouvre (version 1, brouillon).

2. Samuel clique sur **Faire évoluer** : choisissez « Soumettre en revue » ; cliquez sur **Ajouter une étape**, type
   « Personne », « Grâce TEST-EWANE » ; **Confirmer**.

3. Grâce (notifiée) ouvre le document, **Faire évoluer** › « Valider » › **Confirmer**.
4. Samuel : **Faire évoluer** › « Publier (bon pour exécution) » › **Confirmer**.
5. Samuel : **Nouvelle version** : déposez « Plan RDC v2 », **Motif de la révision** ★ `Ajout d'une fenêtre`, cochez
   **Révision majeure** ; **Déposer**. Refaites les étapes 2 à 4 sur cette version.

**Résultat attendu** : dès le dépôt, l'**aperçu du PDF** s'affiche dans la fiche du document (et en **Plein écran**) —
jamais une icône de document cassé ; la version publiée porte « bon pour exécution » ; après publication de la v2,
la v1 est **périmée** (obsolète).

- [ ] **M9** — Circuit de validation et de publication d'un plan fonctionnel.

### Scène M10 — Le plan arrive chez Paul, en aperçu

**Qui** : Samuel, puis Paul. **Où** : fiche du document « Plan RDC », puis l'espace client.

**Méthode**

1. Samuel clique sur **Propriétés** (fenêtre **Propriétés du document**), coche **Visible par le client** et **Livrable
   d'études payant** (laissez **Facture d'études qui débloque le livrable** vide pour l'instant), **Enregistrer**.

2. Paul (**GLOBUS CLI**) : menu **Documents**, ligne « Plan RDC » : cliquez sur **Aperçu filigrané**.

**Résultat attendu** : Paul voit seulement la version en vigueur, avec l'étiquette « Livrable d'études : remis après
règlement de la facture d'études » ; l'aperçu porte un filigrane « APERÇU — livrable remis après règlement… » à son nom ;
aucun bouton ne permet de télécharger l'original.

- [ ] **M10** — Plan consultable en aperçu filigrané seulement, original protégé.

### Scène M11 — La maquette 3D (si vous avez un fichier IFC ou RVT)

**Qui** : Samuel. **Où** : *Projets › Hub BIM*, onglet **Maquettes**.

**Méthode**

1. **Nouvelle maquette** : **Nom** ★ `Villa Mballa — Architecture`, **Discipline** ★ « Architecture », **Créer**.
2. Ouvrez la maquette, **Nouvelle version** : déposez le fichier, **Motif de la révision** `Version initiale`, cochez
   **Rendre visible dans l'espace client (immersion 3D)**, **Déposer**.

3. Attendez que la conversion se termine (statut « prête », plusieurs minutes), puis **Valider** et **Publier**.

**Résultat attendu** : la maquette s'affiche en 3D ; Paul la voit dans **Maquette 3D / BIM**, sur le site comme dans
l'application **GLOBUS Client** (rubrique **Immersion › Maquette 3D / BIM**) : la maquette occupe l'écran et se
manipule au doigt (rotation, zoom). **Sans fichier, notez la scène « non testée ».**

- [ ] **M11** — Maquette publiée (ou « non testée »).

### Scène M12 — Le QR code du séjour

**Pourquoi** : chaque pièce aura un QR code ; le scanner montre aux ouvriers les plans et tâches de cette pièce.

**Qui** : Samuel. **Où** : *Hub BIM*, onglet **Zones**.

**Méthode**

1. **Nouvelle zone**, **Créer** :

| Champ | Valeur | |
| --- | --- | --- |
| Chantier | « Parcelle Bonamoussadi » | |
| Code | `Z-SEJOUR` | ★ |
| Nom | `Séjour RDC` | ★ |
| Niveau | `RDC` | |
| Type de zone | « Pièce » | |
| Surface (m²) | `35` | |
| Libellé client | `Séjour` | |

2. Sur la zone, cliquez sur **QR de la zone**, puis **Imprimer**.

**Résultat attendu** : le QR code s'imprime. Gardez-le pour le chapitre 11.

- [ ] **M12** — QR de zone imprimé.

### Scène M13 — La réunion de lancement

**Qui** : Samuel. **Où** : *Projets › Agenda*.

**Méthode**

1. Cliquez sur **Nouvel événement** :

| Champ | Valeur | |
| --- | --- | --- |
| Titre | `Réunion de lancement` | ★ |
| Type | « Visite de chantier » | |
| Projet | « TEST — Villa Mballa » | |
| Début / Fin | demain 10:00 / demain 11:00 | ★ |
| Lieu | `Bureau GLOBUS` | |
| Participants | « Paul TEST-MBALLA », « Ernest TEST-TCHOUA » | |
| Rappels (minutes avant) | `60` puis **Entrée** | |
| Créer la visioconférence | coché | |
| Visible par le client | coché | |

2. Cliquez sur **Créer l'événement**.
3. Paul (**GLOBUS CLI**) : menu **Mes rendez-vous**, retrouvez l'événement (pastille sur le jour), ouvrez-le, cliquez
   sur **Ajouter à mon calendrier (.ics)**.

**Résultat attendu** : Paul et Ernest sont notifiés (heure locale exacte dans la notification) ; l'événement figure
dans **Mes rendez-vous** de l'espace client et de l'application GLOBUS Client ; le fichier .ics s'ouvre dans un agenda.

- [ ] **M13** — Agenda et invitations fonctionnels.

### Scène M14 — Le risque de la saison des pluies

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Risques**.

**Méthode** : **Nouveau risque**, **Créer** :

| Champ | Valeur | |
| --- | --- | --- |
| Titre | `Saison des pluies` | ★ |
| Catégorie | « Planning » | |
| Probabilité | `4` (échelle 1 à 5) | |
| Impact | `3` (échelle 1 à 5) | |
| Responsable | « Samuel TEST-FOTSO » | |
| Mesures de maîtrise | `Bâcher les fouilles, avancer le terrassement` | |
| Statut | « Identifié » | |
| Exposition financière | `500000` | |

**Résultat attendu** : le risque apparaît avec un score de 12 (4 × 3).

- [ ] **M14** — Registre des risques fonctionnel.

### Scène M15 — Le panneau de chantier connecté

**Pourquoi** : le panneau devant le chantier porte un QR code menant à une page publique (permis, avancement).

**Qui** : Samuel. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Panneau connecté**.

**Méthode**

1. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Titre affiché | `Villa Mballa` | ★ |
| Adresse de la page | proposée (lettres, chiffres, tirets) | |
| Localisation affichée | `Bonamoussadi, Douala` (jamais l'adresse exacte) | |
| Maître d'ouvrage affiché | `Famille M.` | |
| Entreprise | `GLOBUS ENGINEERING` | |
| N° du permis de bâtir | `PC-TEST-2026-001` | |
| Date du permis | une date passée | |
| Interrupteurs | **Avancement** et **Photos** activés | |

2. Cliquez sur **Enregistrer**, puis **Publier**.
3. Cliquez sur **Panneau A3 (PDF)** ; scannez son QR code avec un téléphone.

**Résultat attendu** : le PDF contient un QR code qui ouvre la page publique du chantier ; le compteur **Scans du QR
code** augmente.

- [ ] **M15** — Panneau publié.

### Scène E1 — Le rendu 3D, deuxième livrable d'études

**Pourquoi** : chez GLOBUS, plans **et** visuels 3D font partie des études ; tant qu'ils ne sont pas réglés, Paul les voit
en aperçu filigrané seulement.

**Qui** : Samuel, puis Paul. **Où** : *Projets › GED* ; puis espace client, menu **Documents**.

**Méthode**

1. Samuel : **Déposer un document** : **Fichier** ★ l'image « Rendu façade » (JPG ou PNG, annexe D), **Titre** ★
   `Rendu 3D façade`, **Type** ★ « Plan », **Confidentialité** ★ « Interne », **Projet** « TEST — Villa Mballa » ;
   **Déposer**.

2. Faites-le valider puis publier comme le plan (scène M9, étapes 2 à 4).
3. **Propriétés** : cochez **Visible par le client** et **Livrable d'études payant** ; **Enregistrer**.
4. Paul : **Documents**, ligne « Rendu 3D façade », **Aperçu filigrané**.

**Résultat attendu** : l'image s'ouvre réduite et couverte d'un filigrane « APERÇU — livrable remis après règlement… » ;
aucun bouton ne télécharge l'original.

- [ ] **E1** — Rendu 3D publié en aperçu filigrané seulement.

### Scène E2 — Paul valide le plan

**Pourquoi** : le client approuve formellement chaque étude avant toute facturation ; sa validation est datée et figée.

**Qui** : Samuel, puis Paul. **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet
**Décisions** ; puis espace client, menu **Validations**.

**Méthode**

1. Samuel : **Demander une décision** :

| Champ | Valeur | |
| --- | --- | --- |
| Type | « Plan » | |
| Titre | `Validation du plan RDC et du rendu 3D` | ★ |
| Description | `Plan RDC v2 et rendu de la façade` | |
| Type de référence | « Version de document » | |
| Pièce concernée | « Plan RDC » (version publiée) | |
| Date d'échéance | dans 7 jours | |

   **Créer**.

2. Paul : **Validations**, onglet **Décisions**, **Valider** ; **Recevoir le code par** « E-mail », **Recevoir mon code**,
   tapez le code, **Confirmer**.

3. Samuel : onglet **Études et livrables**.

**Résultat attendu** : la décision passe **Validé** ; dans **Études et livrables**, le « Plan RDC » affiche la validation
et le compteur **Validés par le client** passe à 1.

- [ ] **E2** — Étude validée par le client, par code.

### Scène E3 — La facture d'études

**Pourquoi** : les études, validées, sont facturées ; les livrables sont rattachés à cette facture, qui les débloquera.

**Qui** : Rachel (profil **GLOBUS FIN**), Grâce, puis Samuel. **Où** : *Finance › Facturation*, onglet **Factures
clients** ; puis l'onglet **Études et livrables** du projet.

**Méthode**

1. Rachel : **Nouvelle facture** :

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | |
| Type | « Études et conception » | |
| Titre | `Études, plans et 3D — Villa Mballa` | ★ |
| Date d'émission | aujourd'hui | ★ |
| Date d'échéance | dans 15 jours | |
| Taux de TVA | `19.25` | |
| Lignes | Désignation ★ `Études et conception (plans, 3D, notes)`, Unité `forfait`, Quantité ★ `1`, Prix unitaire ★ `3000000` | ★ |

   **Créer** : la facture est une **proforma** (colonne **Catégorie** « Proforma (brouillon) ») ; sur la ligne,
   **Proforma (PDF)** ouvre un PDF marqué « FACTURE PROFORMA » avec le tampon **PROFORMA**. Rachel essaie
   **Valider (facture définitive)** : refus « Double regard : la facture est validée par une autre personne que celle
   qui l'a préparée ».

   Grâce : sur la ligne, **Valider (facture définitive)**, **Confirmer** ; Rachel : **Envoyer au client**, **Confirmer**.

2. Samuel : onglet **Études et livrables** : **Facture d'études** = la facture `FAC-…` ; cliquez sur **Rattacher les
   livrables sans facture**.

**Résultat attendu** : facture **Envoyé**, 3 000 000 HT, **3 577 500 TTC** ; « 2 livrable(s) seront remis au règlement de
la facture » ; chaque livrable affiche **Facture FAC-…** et **Aperçu seulement**. Le PDF de la facture s'intitule
**FACTURE D'ÉTUDES** et respecte l'annexe H (en particulier « Arrêtée la présente facture à la somme de : Trois
millions cinq cent soixante-dix-sept mille cinq cents francs CFA »).

- [ ] **E3** — Facture d'études émise, livrables rattachés.

### Scène E4 — Paul règle les études : les livrables lui sont remis

**Pourquoi** : le règlement transfère les études au client : les originaux deviennent les siens.

**Qui** : Paul, Rachel, Grâce. **Où** : espace client, **Finances** ; *Finance › Facturation*, la facture ; *Finance ›
Finances*, onglet **Paiements**.

**Méthode**

1. Paul : **Finances** : la facture d'études apparaît ; **Payer** affiche « Aucun moyen de paiement en ligne n'est activé… »
   (si le service n'est pas activé : annexe A) ; **Annuler**.

2. Rachel : sur la facture, **Enregistrer un encaissement** : **Montant encaissé** *(vide : solde)*, **Mode de règlement** ★
   « Virement bancaire », **Date de valeur** ★ hier, **Référence** `VIR-ETUDES-0001`, **Preuve de l'encaissement** ★ le
   PDF « Avis de crédit » ; **Enregistrer un encaissement**.

3. Grâce : onglet **Paiements**, l'encaissement **À approuver** : **Approuver**.
4. Paul : regardez ses notifications, puis **Documents**.

**Résultat attendu**

- Avant l'approbation de Grâce, les livrables restent en aperçu (un encaissement non approuvé ne débloque rien).
- Après : facture **Payé** ; Paul reçoit « Vos livrables d'études sont disponibles » (e-mail et notification) ;
  **Documents** affiche **Livrable remis** et **Télécharger l'original** : le plan et le rendu s'ouvrent **sans
  filigrane d'aperçu**, en pleine résolution.
- Onglet **Études et livrables** : chaque livrable est **Remis** avec la date ; compteur **Remis au client** à 2.
- Le **reçu** PDF (Paul, **Finances**) respecte l'annexe H : « Reçu de » Paul, montant, moyen, référence
  `VIR-ETUDES-0001`, date de valeur, projet, pièce réglée et « Reçu la somme de : … francs CFA ».

- [ ] **E4** — Études réglées, livrables remis au client.

---

## Chapitre 8 — Le devis des travaux et le contrat

*Les études sont validées et réglées : Paul a ses plans. Jordan prépare maintenant le devis de construction, fondé sur
ces études ; une fois accepté et signé, le contrat rejoint le projet existant.*

### Scène B1 — Le devis des travaux

**Pourquoi** : les études validées et réglées (chapitre 7), le devis des travaux se fonde sur elles : clair, ligne par
ligne, avec un échéancier qui totalise 100 %. Il se rattache automatiquement au projet né des études.

**Qui** : Jordan. **Où** : *Commercial › CRM*, onglet **Pipeline**, bouton **Devis** sur la carte de Paul.

**Méthode**

1. Cliquez sur **Devis** : la fenêtre **Nouveau devis** s'ouvre, avec l'opportunité, le client et le contact déjà repris
   (le devis sera rattaché au projet « TEST — Villa Mballa »).

2. En-tête :

| Champ | Valeur | |
| --- | --- | --- |
| Intitulé du devis | `Villa Mballa — construction R+1` | ★ |
| Valable jusqu'au | dans 30 jours | |
| Nature du devis | « Travaux » (proposé) | |
| Devise | « FCFA (XAF) » | |
| TVA (%) | `19.25` (proposé) | |
| Remise globale (montant) | `0` | |
| Introduction | `Construction de la villa R+1 de Bonamoussadi selon les études validées.` | |

3. **Lignes chiffrées** : une ligne vide est déjà présente ; remplissez-la, puis cliquez sur **Ligne** pour chaque ligne
   suivante. La colonne qui compte est **Désignation** ★ ; **Section** n'est qu'un titre de regroupement (facultatif).

| Section | Lot | Désignation ★ | Unité | Qté ★ | PU HT ★ | Remise % |
| --- | --- | --- | --- | --- | --- | --- |
| `Gros œuvre` | `GO` | `Gros œuvre` | `forfait` | `1` | `15000000` | `0` |
| `Second œuvre` | `SO` | `Second œuvre` | `forfait` | `1` | `7000000` | `0` |
| `Électricité` | `ELEC` | `Électricité` | `forfait` | `1` | `3000000` | `0` |

4. **Échéancier de paiement** : cliquez trois fois sur **Échéance** et remplissez :

| Libellé de l'échéance ★ | % du total ★ | Jalon déclencheur |
| --- | --- | --- |
| `Acompte à la signature` | `30` | `Signature du contrat` |
| `Mi-chantier` | `40` | `Fin du gros œuvre` |
| `Réception` | `30` | `Réception des travaux` |

5. **Conditions particulières** : `Paiement à 15 jours.` Cliquez sur **Créer le devis**.
6. Sur la fiche du devis, cliquez sur **PDF**.

**Résultat attendu**

- Sous-total HT **25 000 000**, TVA 19,25 % **4 812 500**, total TTC **29 812 500** FCFA ; chaque échéance affiche son
  montant.
- Le PDF reprend les sections, les lignes, l'échéancier, aux couleurs de l'entreprise, et respecte l'annexe H :
  « Arrêté le présent devis à la somme de : Vingt-neuf millions huit cent douze mille cinq cents francs CFA », nature
  « Travaux », validité de l'offre, blocs « Pour le client — Bon pour accord » et « Pour GLOBUS ENGINEERING ».

> **Contrôle** : laissez une ligne sans **Désignation** et cliquez sur **Créer le devis** : la plateforme refuse avec
> « Devis incomplet — ligne N : désignation manquante… ». Rien n'est enregistré en silence.

- [ ] **B1** — Devis des travaux juste, rattaché au projet, PDF présentable.

### Scène B2 — Le devis part chez Paul

**Qui** : Jordan. **Où** : fiche du devis.

**Méthode** : cliquez sur **Envoyer**.

**Résultat attendu** : statut **Envoyé** ; le bloc **Lien client** affiche un lien ; un e-mail arrive sur `+client` avec
ce lien.

- [ ] **B2** — Devis envoyé.

### Scène B3 — Paul accepte par code

**Pourquoi** : l'acceptation par code reçu par e-mail vaut signature ; la plateforme en garde la preuve.

**Qui** : Paul (profil **GLOBUS CLI**). **Où** : le lien de l'e-mail (aucune connexion n'est nécessaire pour accepter).

**Méthode**

1. Dans Gmail (adresse `+client`), ouvrez l'e-mail du devis et cliquez sur le lien.
2. Lisez le devis. En bas, cliquez sur **Recevoir mon code de validation** : un code arrive par e-mail.
3. Remplissez :

| Champ | Valeur | |
| --- | --- | --- |
| Code reçu | le code de l'e-mail | ★ |
| Nom et prénom du signataire | `Paul TEST-MBALLA` | ★ |
| J'ai lu le devis et j'accepte ses conditions. | cochée | ★ |

4. Cliquez sur **J'accepte le devis**.

**Résultat attendu** : la page confirme l'acceptation ; chez Jordan, le devis passe **Accepté** avec la preuve (date,
heure, moyen de réception du code) et une notification.

- [ ] **B3** — Devis accepté par code.

### Scène B4 — Le refus puis la révision

**Pourquoi** : un devis refusé se révise sans perdre l'ancienne version.

**Qui** : Jordan. **Où** : *Commercial › CRM*, onglet **Pipeline**, puis la fiche du nouveau devis.

**Méthode**

1. Sur la carte de Paul, cliquez sur **Devis** ; créez un **second** devis avec une seule ligne (Désignation `Option
   piscine`, Qté `1`, PU HT `4000000`) ; **Créer le devis**.

2. Sur ce devis, cliquez sur **Envoyer**.
3. Cliquez sur **Refus client** ; dans **Motif communiqué par le client**, tapez `Prix trop élevé` ; confirmez. Le devis
   passe **Refusé**.

4. Cliquez sur **Réviser** : une nouvelle version (même numéro, révision 2) est créée en **Brouillon**.

**Résultat attendu** : la version refusée reste consultable au statut **Remplacé** ; la révision 2 est en brouillon,
avec les mêmes lignes ; le premier devis, accepté, n'est pas touché (un devis accepté ne peut pas être révisé).

- [ ] **B4** — Refus et révision fonctionnent.

### Scène B5 — Le contrat

**Qui** : Jordan. **Où** : fiche du devis **accepté** (B3).

**Méthode** : cliquez sur **Établir le contrat**, puis confirmez dans la fenêtre **Établir le contrat**.

**Résultat attendu** : la fiche du contrat s'ouvre (statut **Brouillon**), avec le montant, les conditions et le bloc
**Échéancier contractuel** repris du devis.

- [ ] **B5** — Contrat établi.

### Scène B6 — La signature

**Qui** : Jordan. **Où** : fiche du contrat.

**Méthode**

1. Cliquez sur **Enregistrer la signature**. Fenêtre **Enregistrer la signature du contrat** :

| Champ | Valeur | |
| --- | --- | --- |
| Signataire | `Paul TEST-MBALLA` (proposé) | ★ |
| Mode de signature | « Signature manuscrite scannée » | |
| Date de signature | aujourd'hui | |
| Contrat signé scanné | déposez le PDF « Contrat signé » (annexe D) | ★ avec ce mode |

2. Cliquez sur **Enregistrer la signature**.

**Résultat attendu** : statut **Signé** ; l'indicateur **Signature** affiche la date ; un bouton **Contrat signé** permet
d'ouvrir le scan.

- [ ] **B6** — Signature enregistrée.

### Scène B7 — Le contrat de travaux rejoint le projet

**Pourquoi** : le projet existe depuis les études ; le contrat de travaux s'y **rattache** (montant du contrat, budget des
travaux, lots et jalons de paiement) au lieu d'en créer un second. Paul a déjà son espace : rien à refaire de son côté.

**Qui** : Grâce (profil **GLOBUS DIR** : le rattachement crée le budget des travaux), puis Samuel. **Où** : *Commercial
› CRM*, onglet **Contrats**, le contrat signé ; puis la fiche du projet.

**Méthode**

1. Grâce : sur le contrat signé, cliquez sur **Rattacher au projet PRJ-…** ; fenêtre **Rattacher le contrat de travaux au
   projet PRJ-…** : laissez **Chef de projet** vide (Samuel l'est déjà), cliquez sur **Rattacher au projet**.

2. Samuel : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Synthèse**, **Modifier** :
   **Statut** « Préparation », **Enregistrer**.

3. Samuel : onglets **Sites, phases, lots** et **Jalons**.

**Résultat attendu**

- Message « Contrat rattaché au projet PRJ-… » ; le contrat passe **Actif** et son bouton **Projet PRJ-…** ouvre le même
  projet.
- **Synthèse** : montant du contrat **29 812 500 FCFA** TTC ; le projet passe **Préparation**.
- **Sites, phases, lots** : les lots GO, SO et ELEC créés pendant les études sont **réutilisés** (pas de doublon), avec le
  montant du devis.
- **Jalons** : aux côtés d'« Implantation », les trois jalons de paiement de l'échéancier : **Acompte à la signature**
  (30 %), **Mi-chantier** (40 %), **Réception** (30 %).
- **Budget** : une version « Budget des travaux (contrat) ».

> **Contrôle** : Jordan (commercial) ne voit pas le bouton **Rattacher au projet** : il faut aussi le droit de gérer les
> projets.

- [ ] **B7** — Contrat de travaux rattaché au projet d'études (montant, budget, lots, jalons).

### Scène B8 — Le budget de référence des travaux

**Pourquoi** : le budget approuvé sert de référence pour mesurer la marge.

**Qui** : Rachel (profil **GLOBUS FIN**), puis Grâce (profil **GLOBUS DIR**). **Où** : fiche du projet (*Projets › Chantiers*, ligne « TEST — Villa Mballa »), onglet **Budget**.

**Méthode**

1. Rachel ouvre l'onglet **Budget** et vérifie la version « Budget des travaux (contrat) » dans **Budgets (versions)**.
2. Rachel crée une version ajustée : **Nouvelle version**, fenêtre **Nouvelle version de budget** :

| Champ | Valeur | |
| --- | --- | --- |
| Libellé | `Budget de référence` | ★ |
| Chiffre d'affaires visé | `25000000` | |
| Lignes | une ligne par lot (bouton d'ajout) — voir ci-dessous | ★ |

| Lot | Catégorie | Libellé | Montant |
| --- | --- | --- | --- |
| GO | « Matériaux » | `Ciment, acier, agrégats` | `9000000` |
| GO | « Main-d'œuvre » | `Équipe gros œuvre` | `3000000` |
| ELEC | « Sous-traitance » | `Électricité` | `2000000` |
| SO | « Matériaux » | `Second œuvre` | `5000000` |

   **Enregistrer**.

3. Rachel essaie de cliquer sur **Approuver** sur sa propre version : refusé (séparation des tâches).
4. Grâce ouvre la même version et clique sur **Approuver**.

**Résultat attendu** : étape 3, la plateforme refuse (« Séparation des tâches : un budget est approuvé par une autre
personne que son auteur ») ; étape 4, la version passe **Approuvé** et devient la référence des marges.

- [ ] **B8** — Budget de référence approuvé, séparation des tâches respectée.

---

## Chapitre 9 — Le ciment de Martin (la chaîne d'achat)

*Cent sacs de ciment pour les fondations. Ce chapitre suit leur voyage : demande d'Ernest, approbations, commande de
Linda, livraison, réception, stock, facture, paiement. Chacun joue son rôle ; personne ne peut tout faire seul.*

> **Les circuits d'approbation** sont réglés par des **règles d'approbation** (par montant). Par défaut : une demande
> jusqu'à 500 000 FCFA est approuvée par le chef de projet ; de 500 000 à 5 000 000 FCFA, par le chef de projet
> (niveau 1) **puis** par l'acheteur (niveau 2) ; au-delà, la direction intervient. Notre demande (100 sacs × 5 200 =
> 520 000 FCFA) passe donc par **Samuel puis Linda**.

### Scène H1 — Le dépôt du chantier et l'article ciment

**Qui** : Ernest (profil **GLOBUS CDC**, rôle Magasinier). **Où** : *Achats et logistique › Stocks*, onglet des
référentiels (articles, dépôts, emplacements).

**Méthode**

1. **Nouveau dépôt**, **Créer** :

| Champ | Valeur | |
| --- | --- | --- |
| Code | `DEP-S1` | ★ |
| Nom | `Dépôt chantier Villa Mballa` | ★ |
| Type | « Chantier » | |
| Projet | « TEST — Villa Mballa » | |
| Chantier | « Parcelle Bonamoussadi » | |
| Responsable | « Ernest TEST-TCHOUA » | |
| Actif | coché | |

2. **Nouvel article**, **Créer** :

| Champ | Valeur | |
| --- | --- | --- |
| Référence (SKU) | `CIM-425` | ★ |
| Nom | `Ciment CPJ 42.5 sac 50 kg` | ★ |
| Catégorie | `ciment` | |
| Unité | `sac` | |
| Seuil d'alerte | `20` | |
| Quantité de réapprovisionnement | `100` | |
| Fournisseur préféré | « TEST Quincaillerie du Wouri » | |
| Consommable | coché | |
| Actif | coché | |

**Résultat attendu** : le dépôt et l'article apparaissent.

- [ ] **H1** — Dépôt et article créés.

### Scène H2 — Ernest demande du ciment

**Qui** : Ernest. **Où** : *Achats et logistique › Achats*, onglet **Demandes d'achat**.

**Méthode**

1. **Nouvelle demande** :

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | ★ |
| Chantier | « Parcelle Bonamoussadi » | |
| Lot | « GO » | |
| Urgence | « Normale » | |
| Justification | `Coulage des fondations` | ★ pour soumettre |
| Besoin pour le | dans 5 jours | |
| Lignes (bouton d'ajout) | une ligne : voir ci-dessous | ★ |
| Soumettre immédiatement | coché | |

| Article de stock | Description ★ | Quantité ★ | Unité | Prix unitaire estimé |
| --- | --- | --- | --- | --- |
| « CIM-425 — Ciment CPJ 42.5… » | `Ciment CPJ 42.5 sac 50 kg` | `100` | `sac` | `5200` |

2. **Créer**.

**Résultat attendu** : la demande passe **Soumise** (total 520 000 FCFA) ; Samuel, premier approbateur, est notifié.

> Sans **Justification**, la plateforme refuse de soumettre (« Justification obligatoire »).

- [ ] **H2** — Demande d'achat soumise.

### Scène H3 — Deux approbations, et personne ne s'approuve soi-même

**Qui** : Samuel (**GLOBUS CDP**), puis Linda (**GLOBUS ACH**). **Où** : *Achats*, onglet **Mes approbations**.

**Méthode**

1. Ernest ouvre sa demande : aucun bouton ne lui permet de l'approuver.
2. Samuel : onglet **Mes approbations**, ouvrez la demande ; lisez le besoin et le **circuit d'approbation** (niveau 1
   chef de projet, niveau 2 acheteur) ; cliquez sur **Approuver**, puis **Confirmer**.

3. Linda : même onglet, ouvrez la demande (niveau 2), **Approuver**, **Confirmer**.

**Résultat attendu** : après Samuel, la demande reste **Soumise** (niveau 2 en attente) ; après Linda, elle passe
**Approuvée**.

- [ ] **H3** — Circuit à deux niveaux et séparation des tâches respectés.

### Scène H4 — Linda choisit le fournisseur et crée le bon de commande

**Qui** : Linda. **Où** : *Achats et logistique › Achats*, onglet **Demandes d'achat**, la demande approuvée.

**Méthode**

1. Dans le bloc du choix du fournisseur, cliquez sur **Classer les fournisseurs** (prix, délai, qualité, stock, zone).
2. Sur la ligne « TEST Quincaillerie du Wouri », cliquez sur **Commander** : fenêtre **Commande chez TEST Quincaillerie du
   Wouri** :

| Champ | Valeur |
| --- | --- |
| Livraison souhaitée | dans 3 jours |
| Canal d'envoi | « E-mail » |
| Notes pour le fournisseur | `Livraison au portail bleu, appeler Ernest` |
| Envoyer immédiatement au fournisseur | **non** coché (on l'envoie à la scène H5) |

3. Cliquez sur **Créer le bon de commande**.
4. Sur le bon de commande : **PDF** pour le voir ; **QR réception** puis imprimez le QR (scène H8).

**Résultat attendu** : bon de commande créé (BC-…) au prix catalogue 5 200 FCFA ; PDF correct ; QR imprimé.

- [ ] **H4** — Bon de commande créé.

### Scène H5 — La commande part chez Martin

**Qui** : Linda. **Où** : fiche du bon de commande.

**Méthode** : **Envoyer au fournisseur** ; fenêtre **Envoyer le bon de commande** : **Canal** « E-mail » ; **Envoyer**.

**Résultat attendu** : statut **Envoyée** ; un e-mail avec le PDF et un lien sécurisé arrive sur `+fournisseur`. (Si
WhatsApp n'est pas activé et que « WhatsApp » est choisi, l'envoi bascule sur l'e-mail.)

- [ ] **H5** — Commande envoyée.

### Scène H6 — Martin contre-propose puis confirme

**Pourquoi** : Martin ne voit que ses propres commandes ; il peut négocier avant de confirmer.

**Qui** : Martin (**GLOBUS FOU**), puis Linda. **Où** : extranet, menu des commandes ; puis l'ERP.

**Méthode**

1. Martin ouvre la commande : il ne voit aucune donnée d'un autre fournisseur.
2. **Proposer une contre-offre** : dans la ligne, prix unitaire `5000` ; **Date de livraison proposée** dans 3 jours ;
   **Votre nom** `Martin TEST-KAMGA` ; **Message** `Prix spécial chantier` ; **Envoyer la contre-offre**.

3. Linda ouvre le bon de commande (statut **Contre-proposée**) et clique sur **Accepter la contre-offre**.
4. Martin clique sur **Confirmer la commande** ; **Votre nom** ; **Commentaire (facultatif)** ; **Confirmer**.

**Résultat attendu** : chez Linda, la commande passe **Confirmée** au prix de 5 000 FCFA (total 500 000).

- [ ] **H6** — Contre-offre et confirmation fonctionnent.

### Scène H7 — L'expédition annoncée

**Qui** : Martin. **Où** : extranet, la commande.

**Méthode** : **Annoncer une expédition** :

| Champ | Valeur | |
| --- | --- | --- |
| Arrivée estimée | demain 09:00 | ★ |
| Transporteur | `Transports Wouri` | |
| Immatriculation | `LT-123-AB` | |
| N° bon de livraison | `BL-TEST-001` | |
| Chauffeur | `Jean` | |
| Téléphone du chauffeur | `690000001` | |

Cliquez sur **Annoncer**.

**Résultat attendu** : la livraison apparaît dans l'ERP (*Achats et logistique › Livraisons*) et dans l'extranet ;
Ernest est prévenu.

- [ ] **H7** — Expédition annoncée.

### Scène H8 — La réception sur le chantier

**Pourquoi** : 98 sacs en bon état, 2 percés : on réceptionne ce qui est conforme et on refuse le reste, avec photo et
position GPS.

**Qui** : Ernest. **Où** : téléphone, application **GLOBUS Terrain** (ou, sans téléphone, l'ERP : bouton
**Réceptionner** du bon de commande).

**Méthode (téléphone)**

1. Connectez-vous avec le compte d'Ernest. Touchez **Réception** (ou **Scanner**) et visez le QR de la scène H4.
2. Indiquez **98** reçus et **2** refusés, motif « Endommagé ».
3. Ajoutez une photo et la photo du bon de livraison ; destination « Stock (dépôt) », dépôt `DEP-S1`.
4. Touchez **Valider la réception**.

**Méthode (ERP)** : bouton **Réceptionner** sur le bon de commande ; **Destination** « Stock (dépôt) », **Dépôt** ★
« DEP-S1 », **Chantier** « Parcelle Bonamoussadi », **N° bon de livraison** `BL-TEST-001` ; par ligne : reçus `98`,
refusés `2`, motif « Endommagé » ; **Relever la position GPS** ; **Enregistrer et valider**.

**Résultat attendu**

- La réception est validée.
- Un incident fournisseur est créé pour les 2 sacs refusés (onglet **Incidents** de la fiche fournisseur).
- Le stock de `DEP-S1` augmente de 98 sacs.

- [ ] **H8** — Réception faite, écart signalé, stock à jour.

### Scène H9 — Les sacs vivent leur vie

**Pourquoi** : chaque mouvement est tracé et le coût des sacs consommés est imputé au chantier.

**Qui** : Ernest. **Où** : *Achats et logistique › Stocks*.

**Méthode**

1. Onglet de l'état du stock : 98 sacs dans `DEP-S1`, valorisés. Onglet des mouvements : l'entrée apparaît.
2. Onglet **Affectations chantier** : **Réserver pour un chantier** :

| Champ | Valeur | |
| --- | --- | --- |
| Article | « CIM-425 » | ★ |
| Dépôt | « DEP-S1 » | ★ |
| Projet | « TEST — Villa Mballa » | ★ |
| Chantier | « Parcelle Bonamoussadi » | |
| Lot | « GO » | |
| Quantité | `30` | ★ |

   **Créer**.

3. Sur la réservation : **Sortir** (**Quantité** ★ `30`) ; puis **Retour** (**Quantité** ★ `5`, **Motif** `Surplus`) ;
   puis **Consommé** (confirmez).

**Résultat attendu** : le stock passe à 73 sacs (98 − 30 + 5) ; dans la fiche projet, onglet **Budget**, liste
**Dépenses** : la sortie (30 sacs) et le retour (−5 sacs), soit **25 sacs** imputés au chantier.

- [ ] **H9** — Mouvements de stock et imputation des coûts corrects.

### Scène H10 — La facture de Martin

**Qui** : Martin. **Où** : extranet, la commande.

**Méthode** : **Déposer une facture** :

| Champ | Valeur | |
| --- | --- | --- |
| Numéro de votre facture | `FAC-TEST-001` | ★ |
| Date de facture | aujourd'hui | ★ |
| Échéance | dans 30 jours | |
| Montant de TVA | `0` | |
| Lignes | quantités préremplies (98) au prix confirmé : ne changez rien | |
| Facture (PDF ou image) | le PDF « Facture fournisseur » | ★ |

Cliquez sur **Déposer la facture**.

**Résultat attendu** : la facture apparaît dans la facturation de l'extranet avec un contrôle « Conforme ».

- [ ] **H10** — Facture fournisseur déposée.

### Scène H11 — Le rapprochement des trois pièces

**Pourquoi** : on ne paie que si la facture correspond à la commande **et** à ce qui a été reçu.

**Qui** : Rachel (**GLOBUS FIN**), puis Grâce (**GLOBUS DIR**). **Où** : *Finance › Facturation*, onglets **Factures
fournisseurs** et **Anomalies 3 pièces**.

**Méthode**

1. Rachel ouvre `FAC-TEST-001`, clique sur **Rapprocher** : commande, réception et facture concordent (98 × 5 000).
   Cliquez sur **Valider (bon à payer)**.

2. **Contre-épreuve** : **Saisir une facture** :

| Champ | Valeur | |
| --- | --- | --- |
| Fournisseur | « TEST Quincaillerie du Wouri » | ★ |
| Bon de commande | le BC de la scène H4 | |
| N° de facture du fournisseur | `FAC-TEST-002` | ★ |
| Date de facture | aujourd'hui | ★ |
| Lignes | Désignation `Ciment CPJ 42.5`, Qté `98`, Prix unitaire `6000` | ★ |
| Lancer le rapprochement 3 pièces dès l'enregistrement | coché | |

   **Enregistrer la facture**. Elle part dans l'onglet **Anomalies 3 pièces**.

3. Grâce l'ouvre, clique sur **Arbitrer** : **Décision** ★ « Rejeter la facture », **Justification** ★ `Prix supérieur
   au bon de commande` ; **Enregistrer**.

**Résultat attendu** : `FAC-TEST-001` est **bon à payer** ; `FAC-TEST-002` est arrêtée puis rejetée.

- [ ] **H11** — Le rapprochement des trois pièces protège des erreurs.

### Scène H12 — L'ordre de paiement

**Qui** : Rachel. **Où** : *Finance › Facturation*, onglet **Factures fournisseurs**, la facture `FAC-TEST-001`.

**Méthode** : cliquez sur **Payer** ; fenêtre **Ordre de paiement** :

| Champ | Valeur | |
| --- | --- | --- |
| Pièce à régler | « Facture fournisseur » | ★ |
| Facture fournisseur | `FAC-TEST-001` (seules les factures validées, « bon à payer », sont proposées) | ★ |
| Montant | proposé (490 000) | |
| Mode de règlement | « Virement bancaire » | ★ |
| Notes | `Règlement ciment` | |

Cliquez sur **Créer l'ordre de paiement**.

**Résultat attendu** : l'ordre de paiement est créé, en attente d'approbation.

- [ ] **H12** — Ordre de paiement créé.

### Scène H13 — Le double regard

**Qui** : Rachel, puis Grâce. **Où** : *Finance › Finances*, onglet des paiements.

**Méthode**

1. Rachel ouvre son ordre de paiement et clique sur **Approuver**.
2. Grâce ouvre le même paiement et clique sur **Approuver** (fenêtre **Approuver le paiement**), confirme.

**Résultat attendu** : Rachel est refusée (« Séparation des tâches : l'initiateur ne peut pas approuver son
paiement ») ; Grâce réussit, le paiement passe **Approuvé**.

- [ ] **H13** — Double regard fonctionnel.

### Scène H14 — L'exécution du virement

**Qui** : Rachel. **Où** : *Finance › Finances*, onglet **Paiements**, le paiement approuvé.

**Méthode** : **Exécuter** ; fenêtre **Exécuter le paiement** :

| Champ | Valeur | |
| --- | --- | --- |
| Canal d'exécution | « Virement / Mobile Money effectué hors plateforme (preuve jointe) » | |
| Référence bancaire / Mobile Money | `VIR-TEST-0001` (elle servira au relevé bancaire, scène F3) | |
| Preuve d'exécution | le PDF « Preuve de virement » | ★ |

Cliquez sur **Confirmer l'exécution**.

**Résultat attendu** : paiement **Payé**, facture **Payée** ; Martin voit le règlement dans son extranet.

- [ ] **H14** — Paiement exécuté, visible du fournisseur.

### Scène H15 — Noter Martin et clôturer la commande

**Qui** : Linda. **Où** : *Achats et logistique › Achats*, onglet **Bons de commande**, le bon de commande.

**Méthode**

1. **Noter le fournisseur** :

| Champ | Valeur | |
| --- | --- | --- |
| Qualité | `4` (de 1 à 5) | ★ |
| Ponctualité | `5` | ★ |
| Conformité | `3` (2 sacs percés) | ★ |
| Communication | `5` | ★ |
| Commentaire | `Bonne réactivité` | |

   **Enregistrer**.

2. **Clôturer** et confirmez.

**Résultat attendu** : bon de commande **Clôturé** ; la note apparaît dans l'onglet **Performance** de la fiche
fournisseur et dans l'extranet de Martin.

- [ ] **H15** — Notation et clôture fonctionnent.

### Scène H16 — Les papiers de Martin

**Qui** : Martin, puis Linda. **Où** : extranet, menu des documents ; puis ERP, fiche fournisseur, onglet **Documents**.

**Méthode**

1. Martin : **Déposer un document** : **Type** « Attestation de régularité fiscale », **Intitulé** `Attestation fiscale 2026`, **Valable
   jusqu'au** dans 6 mois, le PDF ; **Déposer**.

2. Linda : fiche fournisseur, onglet **Documents**, sur l'attestation : **Marquer vérifié**.

**Résultat attendu** : chez Martin, le document passe « vérifié par GLOBUS ».

- [ ] **H16** — Documents légaux du fournisseur gérés.

---

## Chapitre 10 — L'électricité de Sylvie (la sous-traitance)

*Le lot électricité est confié à l'entreprise de Sylvie. Ce chapitre suit tout le circuit : qualification, appel
d'offres sous pli scellé, négociation, attribution, signature, mobilisation, situation de travaux, contrôle terrain,
facture, paiement, réclamation et litige.*

> **Les chiffres de l'histoire** (pour vérifier les calculs de la plateforme) :
>
> | Poste | Quantité | Prix offert | Prix après négociation (× 0,95) |
> | --- | --- | --- | --- |
> | E1 — Tableau électrique et protections | 1 u | 400 000 | 380 000 |
> | E2 — Points lumineux | 40 u | 15 000 | 14 250 |
> | E3 — Prises de courant | 40 u | 10 000 | 9 500 |
> | **Total HT** | | **1 400 000** | **1 330 000** |
>
> Marché : retenue de garantie 5 %, avance 133 000 récupérée à 10 % par situation, TVA 19,25 %.

> **Qui a le droit de faire quoi** : Samuel (chef de projet) gère consultations, marchés et validation des situations ;
> **seule Grâce (direction) peut attribuer un marché et l'envoyer pour signature** ; Ernest (chef de chantier) fait le
> constat terrain ; Rachel (finance) traite les factures et les paiements.

### Scène S1 — Qualifier l'entreprise de Sylvie

**Pourquoi** : on ne consulte que des entreprises **qualifiées** (dossier noté, assurances valides).

**Qui** : Samuel (profil **GLOBUS CDP**). **Où** : *Sous-traitance › Sous-traitants*, onglet **Sous-traitants**, fiche
« TEST Électricité Akwa » (créée à la scène A7, statut **Prospect**).

**Méthode**

1. Cliquez sur **Qualifier** ; fenêtre **Qualification** :

| Champ | Valeur | |
| --- | --- | --- |
| Corps de métier | « Électricité » (proposé d'office) | ★ |
| Critères notés (0 à 5) | cliquez : Références `4`, Capacité (moyens humains et matériels) `4`, Sécurité `4`, Solidité financière `3`, Qualité `4` | ★ |
| Références chantier | bouton **Référence** : Projet `Immeuble R+3 Akwa`, Client `TEST SCI Akwa`, Année `2025`, Montant (FCFA) `9000000` | |
| Pièces justificatives | déposez le PDF « Attestation d'assurance » | |
| Décision | « Approuvé » | ★ |
| Commentaire | `Dossier complet` | |

2. Sous les critères, lisez le score : **77 / 100** (50 minimum pour approuver). Cliquez sur **Enregistrer**.

**Résultat attendu** : la fiche passe **Qualifié** ; onglet **Qualifications** : « Électricité — score 77 », valable 2 ans.

> **Contrôle** : une approbation est refusée si le score est sous 50 (« Score de qualification insuffisant ») ou si
> l'**Assurance RC** est absente ou expirée. Pour le gros œuvre, la charpente, la couverture… l'**assurance décennale** est
> aussi exigée.

- [ ] **S1** — Sous-traitant qualifié, score correct.

### Scène S2 — L'appel d'offres du lot électricité

**Pourquoi** : la consultation met plusieurs entreprises en concurrence sur un bordereau de prix identique.

**Qui** : Samuel. **Où** : *Sous-traitance › Sous-traitants*, onglet **Consultations**, bouton **Nouvelle consultation**.

**Méthode** : remplissez, dans l'ordre de l'écran :

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | ★ |
| Date limite de remise des offres | dans 3 jours, 12:00 | ★ |
| Intitulé | `Lot électricité Villa Mballa` | ★ |
| Démarrage souhaité | dans 10 jours | |
| Durée cible (jours) | `45` | |
| Description | `Installation électrique complète R+0` | |
| Cahier des charges technique | `Norme NF C 15-100, câbles cuivre, tableau 4 rangées` | |
| Exclusions | `Raccordement ENEO non compris` | |
| Variantes autorisées | non coché | |
| Pièces du dossier de consultation (DCE) | cochez « Plan RDC » (la version publiée à la scène M9) | |
| Critères de notation des offres | laissez Prix 50, Délai 20, Valeur technique 20, Historique avec GLOBUS 10 (total 100 %) | |

Bloc **Lot 1** :

| Champ | Valeur | |
| --- | --- | --- |
| Code | `L1` (proposé) | ★ |
| Intitulé du lot | `Électricité` | ★ |
| Estimation | `1500000` | |
| Lot du projet | « ELEC » | |

Postes du lot (bouton **Poste** pour chaque ligne supplémentaire) :

| Code | Désignation ★ | Unité | Quantité ★ |
| --- | --- | --- | --- |
| `E1` | `Tableau électrique et protections` | `u` | `1` |
| `E2` | `Points lumineux` | `u` | `40` |
| `E3` | `Prises de courant` | `u` | `40` |

Cliquez sur **Créer la consultation**.

**Résultat attendu** : la consultation est créée au statut **Brouillon**, la fiche s'ouvre.

> **Contrôle** : le bouton **Créer la consultation** reste grisé tant que le projet, l'intitulé, la date limite, au moins
> un poste complet par lot et un total de critères égal à 100 % ne sont pas renseignés.

- [ ] **S2** — Consultation créée avec son bordereau et son DCE.

### Scène S3 — Inviter puis publier

**Qui** : Samuel. **Où** : *Sous-traitance › Sous-traitants*, onglet **Consultations**, la consultation.

**Méthode**

1. Cliquez d'abord sur **Publier** : la plateforme refuse (« Inviter au moins un sous-traitant qualifié »).
2. Cliquez sur **Inviter** ; fenêtre **Inviter des entreprises** : **Corps de métier** « Électricité », puis dans la
   liste choisissez « TEST Électricité Akwa » ; cliquez sur **Inviter**.

3. Cliquez sur **Publier**.

**Résultat attendu** : statut **Publié** ; bloc **Invitations** : « TEST Électricité Akwa ». Sylvie reçoit un e-mail et
une notification.

- [ ] **S3** — Invitation et publication (avec le contrôle).

### Scène S4 — Sylvie remet son offre

**Pourquoi** : l'offre est **scellée** : personne chez GLOBUS ne peut la lire avant la date limite.

**Qui** : Sylvie (profil **GLOBUS STT**). **Où** : extranet, menu **Consultations**, la consultation.

**Méthode**

1. Bloc **Dossier de consultation** : cliquez sur **Télécharger** à côté de « Plan RDC » (le PDF porte un filigrane au
   nom de son entreprise).

2. Sur le bloc **Lot L1 — Électricité**, cliquez sur **Remettre une offre** ; fenêtre **Offre — lot L1 Électricité** :

| Poste | Prix unitaire HT ★ |
| --- | --- |
| Tableau électrique et protections | `400000` |
| Points lumineux | `15000` |
| Prises de courant | `10000` |

| Champ | Valeur |
| --- | --- |
| Délai d'exécution proposé (jours) | `40` |
| Mémoire technique (PDF) | le PDF « Mémoire technique » |
| Réserves / exclusions | `Fourniture des luminaires décoratifs par le client` |

3. Vérifiez **Montant total HT de l'offre** : **1 400 000 FCFA**. Cliquez sur **Déposer l'offre**.

**Résultat attendu** : l'offre apparaît sous le lot au statut **Soumis**, avec un bouton **Retirer** (possible jusqu'à
la date limite).

- [ ] **S4** — Offre déposée depuis l'extranet.

### Scène S5 — Le pli scellé, l'ouverture et le comparatif

**Qui** : Samuel. **Où** : *Sous-traitance › Sous-traitants*, onglet **Consultations**, la consultation.

**Méthode**

1. Bloc **Offres** : « 1 offre(s) reçue(s) — ouverture à la date limite » et le cadenas : le contenu est invisible.
2. Pour ne pas attendre trois jours, cliquez sur **Clôturer**, puis **Confirmer** (« Les offres seront ouvertes et plus
   aucune remise ne sera acceptée »).

3. Le comparatif apparaît : montant, écart / estimation (environ −6,7 %), délai, score total. Ouvrez **Bordereau comparé (prix
   unitaires par poste)**.

4. Sur la ligne de Sylvie, cliquez sur **Évaluer** : **Note technique** ★ `80` ; **Enregistrer**.

**Résultat attendu** : statut **Clôturé** ; la note technique et le score total se mettent à jour.

- [ ] **S5** — Offres scellées puis ouvertes, comparatif et évaluation.

### Scène S6 — La négociation

**Qui** : Samuel, puis Sylvie, puis Samuel.

**Méthode**

1. Samuel, ligne de Sylvie : **Négocier** ; **Montant** ★ `1300000`, **Durée (jours)** `40`, **Commentaire**
   `Alignement sur le budget` ; **Enregistrer**.

2. Sylvie, extranet, la consultation : sous son offre, la proposition GLOBUS s'affiche avec **Accepter 1 300 000 FCFA**
   et **Contre-proposer**. Cliquez sur **Contre-proposer** : **Montant HT proposé** ★ `1330000`, **Délai (jours)**
   `40`, **Commentaire** `Prix plancher` ; **Envoyer**.

3. Samuel, ligne de Sylvie : cliquez sur **Accepter 1 330 000 FCFA**.

**Résultat attendu** : le montant de l'offre devient **1 330 000** (l'ancien montant barré) ; **Historique des
négociations** : trois tours.

> **Contrôle** : une partie ne peut pas accepter sa propre proposition, ni en faire deux de suite sans réponse.

- [ ] **S6** — Négociation à trois tours historisée.

### Scène S7 — L'attribution (direction)

**Pourquoi** : attribuer engage l'entreprise : c'est réservé à la direction.

**Qui** : Samuel, puis Grâce (profil **GLOBUS DIR**). **Où** : *Sous-traitance › Sous-traitants*, onglet **Consultations**, la consultation.

**Méthode**

1. Samuel : le bouton **Attribuer** n'apparaît pas pour lui.
2. Grâce : ligne de Sylvie, **Attribuer** ; fenêtre **Attribuer à TEST Électricité Akwa** :

| Champ | Valeur |
| --- | --- |
| Titre | `Électricité Villa Mballa` |
| Retenue de garantie (%) | `5` |
| Avance forfaitaire | `133000` |
| Récupération d'avance (%) | `10` |
| Pénalité par jour | `10000` |
| Plafond des pénalités (%) | `10` |
| Taux de TVA | `19.25` |
| Date de début | aujourd'hui |
| Date de fin | dans 60 jours |
| Conditions | `Conditions générales GLOBUS de sous-traitance` |

3. **Enregistrer**.

**Résultat attendu** : « Marché créé » ; la fiche du marché s'ouvre au statut **Brouillon**, **Montant du marché HT**
**1 330 000 FCFA** (TVA 19,25 %) ; **Bordereau du marché** : 380 000 / 14 250 / 9 500 (prix ramenés au prorata de la
négociation).

- [ ] **S7** — Attribution réservée à la direction, prix négociés repris.

### Scène S8 — Le marché part en signature, Sylvie signe par code

**Qui** : Grâce, puis Sylvie. **Où** : *Sous-traitance › Sous-traitants*, onglet **Marchés**, le marché ; puis extranet, menu **Mes marchés**.

**Méthode**

1. Grâce : **Contrat PDF** pour relire le contrat, puis **Envoyer pour signature**.
2. Sylvie : ouvrez le marché (badge **À signer**), lisez le **Contrat PDF**, cliquez sur **Signer le marché** :

| Champ | Valeur | |
| --- | --- | --- |
| Nom et qualité du signataire | `Sylvie TEST-ABENA, gérante` (3 caractères minimum) | ★ |
| J'ai lu le contrat et j'accepte ses conditions… | coché | ★ |

3. Cliquez sur **Recevoir mon code**, ouvrez l'e-mail, tapez le code dans **Code reçu**, cliquez sur **Signer**.

**Résultat attendu** : « Marché signé » ; statut **Signé** des deux côtés ; la fiche ERP affiche **Signé le … par
Sylvie TEST-ABENA, gérante**.

- [ ] **S8** — Signature électronique par code fonctionnelle.

### Scène S9 — La mobilisation et la facture d'avance

**Pourquoi** : aucune situation n'est possible avant que l'équipe soit accueillie sur le chantier ; l'avance prévue au
marché se facture après signature.

**Qui** : Samuel, puis Rachel (profil **GLOBUS FIN**). **Où** : *Sous-traitance › Sous-traitants*, onglet **Marchés**, le marché.

**Méthode**

1. Samuel : **Mobilisation** ; fenêtre **Mobilisation du sous-traitant** :

| Champ | Valeur | |
| --- | --- | --- |
| Date de mobilisation | aujourd'hui | ★ |
| Effectif | `4` | ★ |
| Encadrant | `Sylvie TEST-ABENA` | |
| Matériel | `Échafaudage roulant, perforateurs` | |
| Accès chantier accordé | coché | |
| Accueil sécurité effectué | coché | |
| Notes | `Badge remis à chaque électricien` | |

   **Enregistrer**.

2. Rachel : **Facture d'avance**, puis **Confirmer** (« Générer la facture d'avance de 133 000 FCFA ? »).

**Résultat attendu** : le marché passe **Mobilisé** (les deux cases cochées sont nécessaires) ; onglet **Factures** de
*Sous-traitance › Sous-traitants* : une facture de type « Avance forfaitaire » de 133 000 FCFA, déjà **Bon à payer**.

- [ ] **S9** — Mobilisation et avance.

### Scène S10 — La première situation de travaux

**Pourquoi** : Sylvie déclare ce qu'elle a fait sur la période, preuves photo à l'appui.

**Qui** : Sylvie. **Où** : extranet, **Mes marchés**, le marché.

**Méthode**

1. **Nouvelle situation** ; fenêtre **Nouvelle situation de travaux** :

| Champ | Valeur | |
| --- | --- | --- |
| Début de période | aujourd'hui | ★ |
| Fin de période | aujourd'hui | ★ |

| Poste | Réalisé sur la période (au moins un poste) |
| --- | --- |
| Tableau électrique et protections | `1` |
| Points lumineux | `20` |
| Prises de courant | `20` |

   Cliquez sur **Créer la situation** : la situation s'ouvre au statut **Brouillon**.

2. Cliquez sur **Soumettre** tout de suite : refus (« Photos probatoires obligatoires »).
3. Bloc **Photos d'avancement** : déposez 2 photos, cliquez sur **Envoyer les photos** (le navigateur peut demander la
   position : acceptez, la photo est géolocalisée).

4. Cliquez sur **Soumettre**.

**Résultat attendu** : statut **Soumis** ; **Montant de la période** 855 000 FCFA (380 000 + 20 × 14 250 + 20 × 9 500).
Samuel et Ernest sont notifiés.

- [ ] **S10** — Situation déclarée avec preuves.

### Scène S11 — Le constat terrain et la validation

**Pourquoi** : on ne paie que ce qui est **constaté** sur place, par quelqu'un d'autre que le déclarant.

**Qui** : Ernest (profil **GLOBUS CDC**), puis Samuel. **Où** : *Sous-traitance › Situations*, la situation.

**Méthode**

1. Ernest : **Constat terrain** ; dans la colonne **Constaté** : `1`, `16`, `20` (4 points lumineux ne sont pas
   finis) ; **Observations** `4 points lumineux sans appareillage` ; **Enregistrer le constat**.

2. Samuel : **Valider** ; fenêtre **Valider la situation** : laissez **Pénalités retenues (si différentes du calcul)** et
   **Motif de l'ajustement des pénalités** vides ; **Enregistrer**.

**Résultat attendu** : après le constat, statut **Constat terrain**, la quantité constatée 16 en orange ; après
validation, statut **Validé** et ces montants :

| Montant | Calcul | Valeur |
| --- | --- | --- |
| Montant de la période (brut) | 380 000 + 16 × 14 250 + 20 × 9 500 | 798 000 |
| Retenue de garantie | 5 % du brut | 39 900 |
| Avance récupérée | 10 % du brut | 79 800 |
| Pénalités | aucun retard | 0 |
| **Net à payer** | brut − retenue − avance | **678 300** |

> **Contrôles** : Ernest ne peut pas valider sa propre situation constatée (double regard) ; valider avant le constat
> est refusé (« Le constat terrain doit précéder la validation ») ; si vous
> saisissez des pénalités différentes, le **Motif** devient obligatoire.

- [ ] **S11** — Constat, validation et calculs exacts.

### Scène S12 — La facture de Sylvie et son paiement

**Qui** : Sylvie, puis Rachel, puis Grâce, puis Rachel. **Où** : extranet, **Situations** ; puis ERP.

**Méthode**

1. Sylvie : ouvrez la situation validée, **Déposer la facture** ; fenêtre **Facture de la situation** :

| Champ | Valeur | |
| --- | --- | --- |
| N° de facture | `ELEC-TEST-001` | ★ |
| Date | aujourd'hui (proposée) | ★ |
| Montant TTC | proposé : **831 915** (net 678 300 + TVA 19,25 % du brut 153 615) | ★ |
| Facture (PDF ou image) | le PDF « Facture sous-traitant » | ★ |

   **Déposer**. (Essai : un autre montant est refusé, « Montant facturé différent du net validé ».)

2. Rachel : *Sous-traitance › Sous-traitants*, onglet **Factures**, filtre **Statut** « Reçu » ; sur `ELEC-TEST-001`,
   **Valider (bon à payer)**, **Confirmer**.

3. Rachel : *Finance › Finances*, onglet **Paiements**, **Ordre de paiement** ; fenêtre **Nouvel ordre de paiement** :

| Champ | Valeur | |
| --- | --- | --- |
| Pièce à régler | « Facture sous-traitant » | ★ |
| Facture sous-traitant | la facture `ELEC-TEST-001` (seules les factures bon à payer sont proposées) | ★ |
| Montant | *(vide : solde la facture)* | |
| Mode de règlement | « Virement bancaire » | ★ |
| Notes | `Situation 1 électricité` | |

   **Créer l'ordre de paiement**.

4. Grâce l'approuve, Rachel l'exécute, exactement comme aux scènes H13 et H14 (référence `VIR-TEST-0002`).

**Résultat attendu** : facture **Bon à payer**, puis **Payé** ; la situation passe **Payé** ; Sylvie voit le règlement
dans son menu **Paiements**.

- [ ] **S12** — Facture conforme, validée, payée.

### Scène S13 — Une réclamation, puis un litige

**Pourquoi** : tout désaccord suit un circuit écrit et horodaté, jusqu'à une décision chiffrée.

**Qui** : Sylvie, Samuel, Grâce. **Où** : extranet, menus **Réclamations** et **Litiges** ; ERP, *Sous-traitance ›
Litiges*.

**Méthode — la réclamation**

1. Sylvie : **Nouvelle réclamation** :

| Champ | Valeur | |
| --- | --- | --- |
| Marché concerné | le marché « Électricité Villa Mballa » | |
| Objet | `Saignées supplémentaires dans le séjour` (3 caractères minimum) | ★ |
| Exposé | `Le client a déplacé deux prises après exécution` | |
| Montant demandé HT | `45000` | |

   **Déposer**.

2. Samuel : *Sous-traitance › Litiges*, onglet **Réclamations** ; sur la ligne, **Répondre** : **Décision** ★
   « Accepter », **Réponse** ★ `Accord, à intégrer à la prochaine situation` ; **Répondre**.

**Méthode — le litige**

3. Sylvie : menu **Litiges**, **Ouvrir un litige** :

| Champ | Valeur | |
| --- | --- | --- |
| Marché | le marché | |
| Situation contestée | la situation 1 | |
| Objet | `Points lumineux non comptés` | ★ |
| Exposé des faits (10 caractères minimum) | `Les 4 points lumineux étaient posés, seul l'appareillage manquait` | ★ |
| Montant contesté | `57000` (4 × 14 250) | |
| Pièces justificatives | une photo | |

   **Ouvrir le litige**.

4. Samuel : ouvrez le litige, **Faire évoluer** : choisissez « En analyse », **Confirmer** ; recommencez avec « En négociation ».
5. Samuel : **Ajouter à la chronologie** : **Type** ★ « Proposition », **Contenu** `Moitié des points acceptée`,
   **Montant** `28500` ; **Enregistrer**.

6. Sylvie : dans le litige, choisissez « Accord sur la proposition GLOBUS (28 500 FCFA) », **Votre message** `D'accord` ;
   **Envoyer**.

7. Grâce : **Décision** : **Montant accepté** ★ `28500`, **Montant refusé** ★ `28500` (la somme doit égaler 57 000),
   **Résumé** ★ `Accord amiable : deux points sur quatre étaient complets` (20 caractères minimum) ; **Enregistrer**.

8. Grâce : **Clore (résolu)**, **Commentaire de clôture** `Clos à l'amiable`, **Confirmer**.

**Résultat attendu** : réclamation **Accepté** ; le litige passe Ouvert → En analyse → En négociation → Décision rendue →
**Résolu** ; la **Chronologie** garde chaque étape, chez GLOBUS comme dans l'extranet. Seule la direction voit les
boutons **Décision** et **Clore (résolu)**.

- [ ] **S13** — Réclamation et litige menés jusqu'à la résolution.

### Scène S14 — Noter l'entreprise

**Qui** : Samuel. **Où** : fiche « TEST Électricité Akwa », onglet **Notations**, bouton **Noter**.

**Méthode** : fenêtre **Noter le sous-traitant** :

| Champ | Valeur | |
| --- | --- | --- |
| Contrat de sous-traitance | le marché « Électricité Villa Mballa » | |
| Qualité | `4` (de 1 à 5) | ★ |
| Délais | `5` | ★ |
| Sécurité | `4` | ★ |
| Propreté | `3` | ★ |
| Conformité | `4` | ★ |
| Coopération | `5` | ★ |
| Commentaire | `Équipe réactive, chantier à nettoyer` | |

**Enregistrer**.

**Résultat attendu** : la note apparaît dans l'onglet ; **Note moyenne** et **Score global** de la fiche se mettent à
jour (ils serviront au critère « Historique avec GLOBUS » des prochaines consultations).

- [ ] **S14** — Notation enregistrée.

---

# Livre V — La vie du chantier

## Chapitre 11 — Une journée sur le chantier (l'application GLOBUS Terrain)

*Ernest et Moussa travaillent avec le téléphone : pointage, tâches, journal, photos, rapport vocal, plans, et même sans
réseau. Les mêmes écrans existent aussi dans l'ERP web (menu* Chantier *de l'application = rubrique* Projets *de l'ERP).*

### Scène T1 — Les fiches du personnel (préalable au pointage)

**Pourquoi** : le pointage est rattaché à une **fiche employé**. Sans fiche liée au compte, l'application affiche
« Aucune fiche employé ».

**Qui** : Rachel (profil **GLOBUS FIN**, rôle Ressources humaines). **Où** : *RH et QHSE › Ressources humaines*, onglet
**Personnel**, bouton **Nouvel employé**.

**Méthode** : créez deux fiches, **Créer** après chacune :

| Champ | Ernest | Moussa | |
| --- | --- | --- | --- |
| Matricule | `TEST-001` | `TEST-002` | |
| Compte utilisateur (auto-pointage, espace salarié) | « Ernest TEST-TCHOUA » | « Moussa TEST-BELLO » | |
| Prénom | `Ernest` | `Moussa` | ★ |
| Nom | `TEST-TCHOUA` | `TEST-BELLO` | ★ |
| Fonction | `Chef de chantier` | `Électricien` | ★ |
| Métier | « Gros œuvre » | « Électricité » | |
| Type de contrat | « CDI » | « Journalier » | |
| Date d'embauche | le 1er du mois | le 1er du mois | ★ |
| Salaire de base | `350000` | *(vide)* | |
| Taux journalier | *(vide)* | `8000` | |
| Fréquence de paie | « Mensuelle » | « Mensuelle » | |
| Projet actuel | « TEST — Villa Mballa » | « TEST — Villa Mballa » | |

**Résultat attendu** : deux fiches actives, chacune reliée à son compte.

- [ ] **T1** — Fiches employés liées aux comptes.

### Scène T2 — Le QR de pointage affiché à l'entrée

**Qui** : Rachel. **Où** : *Ressources humaines*, onglet **Pointage**, carte **QR d'auto-pointage du chantier**.

**Méthode** : **Projet** « TEST — Villa Mballa », **Site** « Parcelle Bonamoussadi » ; le QR apparaît ; cliquez sur
**Imprimer** (ou gardez-le affiché à l'écran pour la scène suivante).

**Résultat attendu** : un QR propre à ce site, imprimable.

- [ ] **T2** — QR du chantier généré.

### Scène T3 — Moussa pointe son arrivée et son départ

**Pourquoi** : le pointage vérifie le QR **et** la position du téléphone (périmètre défini à la scène M3).

**Qui** : Moussa, sur son téléphone, application **GLOBUS Terrain**. **Où** : menu **Personnel › Pointage**.

**Méthode**

1. Connectez-vous avec le compte de Moussa (e-mail, mot de passe, code à 6 chiffres si activé).
2. **Pointage** › **Scanner le QR du chantier** ; autorisez la caméra et la position ; visez le QR ; choisissez
   « Arrivée ».

3. En fin de journée : même geste, choisissez « Départ ».
4. Essai : refaites « Arrivée » le même jour.

**Résultat attendu** : « Arrivée enregistrée », puis « Départ enregistré » ; le bloc **Aujourd'hui** affiche les deux
heures. L'essai 4 est refusé (« Arrivée déjà enregistrée ce jour »). Dans l'ERP (onglet **Pointage**), colonne **Zone** :
**Sur site** ou **Hors zone** selon l'endroit où était le téléphone (si vous testez loin de la parcelle, « Hors zone » est
normal : le pointage est gardé mais signalé). Une arrivée plus de 15 minutes après l'horaire de début est
marquée **En retard**.

- [ ] **T3** — Auto-pointage par QR et géolocalisation.

### Scène T4 — La validation des pointages

**Qui** : Ernest (ou Rachel). **Où** : ERP, *Ressources humaines*, onglet **Pointage**.

**Méthode** : sur la ligne de Moussa, **Valider**, puis **Confirmer**.

**Résultat attendu** : le pointage est validé ; il comptera dans la paie (chapitre 14).

- [ ] **T4** — Pointage validé.

### Scène T5 — Mes tâches

**Qui** : Ernest. **Où** : application, **Chantier › Mes tâches** (désactivez le filtre **Mes tâches** pour voir toutes
les tâches du chantier).

**Méthode**

1. Touchez la tâche « Implantation » (scène M6) ; bloc **Avancement** : faites glisser à `50 %`.
2. **Note (travaux réalisés, difficultés)** : `Piquetage terminé, chaises en place` ; **Enregistrer**.
3. Bloc **Photos de la tâche** : **Ajouter**, prenez une photo.

**Résultat attendu** : l'avancement 50 % apparaît dans l'ERP (*Projets › Planning*) et dans la courbe du projet.

- [ ] **T5** — Avancement saisi sur le terrain.

### Scène T6 — Le journal de chantier du jour

**Pourquoi** : le rapport journalier est la mémoire du chantier (effectifs, météo, aléas) ; il est validé par le chef de
projet.

**Qui** : Ernest, puis Samuel. **Où** : application, **Chantier › Journal de chantier** ; puis ERP, fiche du projet,
onglet **Journal de chantier**.

**Méthode**

1. Ernest : **Rapport du jour** ; remplissez :

| Champ | Valeur |
| --- | --- |
| Date | aujourd'hui (30 jours en arrière au plus) |
| Météo | « Pluie légère » |
| Ouvriers GLOBUS | `6` |
| Sous-traitants | `4` |
| Température (°C) | `27` |
| Heures perdues | `1.5` |
| Travaux réalisés | `Implantation, début des fouilles` |
| Difficultés / incidents | `Averse à 14 h, arrêt 1 h 30` |
| Besoins (matériaux, matériel, main-d'œuvre) | `Pompe à eau` |
| Sécurité | `Accueil sécurité des électriciens` |
| Livraisons du jour | `98 sacs de ciment` |
| Visiteurs | `Paul TEST-MBALLA` |

2. Bloc **Photos du jour** : **Ajouter** une photo. Touchez **Enregistrer**, puis **Soumettre au chef de projet** et
   confirmez (« Soumettre le rapport ? »).

3. Samuel (ERP) : onglet **Journal de chantier**, ligne du jour : **Valider**, **Confirmer**.

**Résultat attendu** : le rapport passe **Soumis** (plus modifiable par Ernest), puis **Validé**.

- [ ] **T6** — Journal soumis depuis le terrain et validé.

### Scène T7 — Les photos de chantier, dont une pour Paul

**Qui** : Ernest. **Où** : application, **Chantier › Photos et vidéos**.

**Méthode**

1. **Photo / vidéo** ; prenez une photo des fouilles.
2. **Légende (facultatif)** `Fouilles en cours` ; cochez **Publier au client** ; **Envoyer**.
3. Une deuxième photo, **sans** cocher **Publier au client**.

**Résultat attendu** : les deux photos sont dans l'ERP (onglet **Photos et vidéos** du projet) ; **seule la première**
apparaît dans l'espace de Paul (vérifié au chapitre 12).

- [ ] **T7** — Photos publiées ou internes selon le choix.

### Scène T8 — Le rapport vocal

**Pourquoi** : sur le chantier on parle plus vite qu'on n'écrit ; la reconnaissance vocale du serveur transcrit le message.

**Qui** : Ernest. **Où** : application, **Chantier › Rapports vocaux**.

**Méthode**

1. **Nouveau rapport vocal** ; parlez 20 secondes (« Fouilles terminées à soixante pour cent, prévoir la pompe demain ») ;
   arrêtez ; **Envoyer**.

2. Quand la **Transcription** apparaît, corrigez-la si besoin, puis **Valider**.

**Résultat attendu** : message « Rapport envoyé : transcription en cours, le chef de projet est prévenu » ; Samuel
reçoit la notification « **Rapport vocal à valider — TEST — Villa Mballa** » (un rapport critique prévient aussi la
direction) qui ouvre *Assistants IA*, onglet **Rapports vocaux** ; **Écouter l'enregistrement** joue le son dans
l'application ; le rapport passe **Transcrit**, puis **Validé** ; le texte est lisible dans l'ERP et dans le journal
de chantier.

> Le service de transcription est interne au serveur : il ne demande ni clé ni compte externe. Si le serveur refuse un
> envoi, le message « Rapport refusé par le serveur : … » s'affiche aussitôt et l'envoi reste dans **Synchronisation**
> (voir T10) : plus de « 1 à arbitrer » silencieux.

- [ ] **T8** — Rapport vocal transcrit et validé.

### Scène T9 — Le QR du séjour

**Qui** : Ernest. **Où** : application, **Chantier › Scanner**.

**Méthode** : scannez le QR de la zone « Z-SEJOUR » imprimé à la scène M12 (ou tapez son code dans **Ou saisir le
code**, puis **Valider**).

**Résultat attendu** : la page de la zone s'ouvre : **Plans**, **Maquette 3D** (si la scène M11 a été jouée),
**Check-list de la zone**, **Photos avant / après**, **Tâches de la zone**, **Issues BIM ouvertes**. Le même scanner
reconnaît aussi le QR de réception d'un bon de commande (scène H8) et le QR de pointage (scène T2).

- [ ] **T9** — Un seul scanner pour tous les QR du chantier.

### Scène T10 — Sans réseau

**Pourquoi** : dans les fouilles, le réseau est souvent absent ; rien ne doit être perdu.

**Qui** : Ernest. **Où** : application, puis **Chantier › Synchronisation**.

**Méthode**

1. Passez le téléphone en **mode avion**.
2. Faites une saisie : avancement de « Implantation » à `80 %` (scène T5) et une photo.
3. Ouvrez **Synchronisation** : les saisies sont **En attente**.
4. Pendant ce temps, Samuel, sur l'ordinateur, met « Implantation » à `70 %`.
5. Ernest coupe le mode avion, touche **Synchroniser maintenant**.

**Résultat attendu** : la photo part ; pour l'avancement modifié des deux côtés, la ligne passe **À arbitrer** et
propose **Garder le bureau**, **Garder ma version** ou **Fusionner**. Choisissez **Garder ma version** : la tâche est à
80 % partout ; l'écran affiche **Tout est synchronisé**.

> **Envois refusés par le serveur** (rubrique **Refusées par le serveur**, motif affiché) : **Renvoyer** remet l'envoi
> en file et relance aussitôt la synchronisation (le même envoi n'est jamais enregistré deux fois) ; **Abandonner**
> le retire après lecture du motif.

- [ ] **T10** — Saisie hors ligne, synchronisation, arbitrage du conflit et renvoi d'un envoi refusé.

---

## Chapitre 12 — Paul suit sa maison (l'espace client pendant les travaux)

*Paul ne vient pas tous les jours sur le chantier : la plateforme lui montre ce qui est public, lui demande ses décisions,
lui soumet les avenants et lui présente ses appels de fonds.*

### Scène R1 — Ce que Paul voit, et ce qu'il ne voit pas

**Qui** : Paul (profil **GLOBUS CLI**). **Où** : espace client, menus **Tableau de bord**, **Chantier**, **Planning**,
**Documents**.

**Méthode** : parcourez ces quatre menus.

**Résultat attendu** :
- **Chantier** : la photo « Fouilles en cours » publiée à la scène T7 ; **pas** la photo interne.
- **Planning** : les tâches cochées « Visible par le client » (Implantation, Fondations) ; **pas** Terrassement ni
  Élévation murs (scène M6).
- **Documents** : le « Plan RDC » publié (scène M10), dans sa dernière version.
- Aucun coût interne (budget, prix des sous-traitants, marges) n'apparaît nulle part.

- [ ] **R1** — Cloisonnement client respecté.

### Scène R2 — Une décision à prendre : le carrelage

**Pourquoi** : les choix du client sont tracés, avec leur impact sur le prix et le délai, et validés par code.

**Qui** : Samuel, puis Paul. **Où** : fiche du projet, onglet **Décisions** ; puis espace client, **Validations**.

**Méthode**

1. Samuel : **Demander une décision** :

| Champ | Valeur | |
| --- | --- | --- |
| Type | « Matériau » | |
| Titre | `Carrelage du séjour` | ★ |
| Description | `Choix du revêtement de sol du séjour (35 m²)` | |
| Options proposées au client | bouton **Option** deux fois : A `Grès cérame 60×60`, Impact prix (FCFA) `0`, Impact délai `0` ; B `Marbre reconstitué`, Impact prix `450000`, Impact délai `5` | |
| Date d'échéance | dans 7 jours | |

   **Créer**.

2. Paul : **Validations**, onglet **Décisions** : lisez les deux options et leurs impacts ; cliquez sur **Valider** ;
   cochez l'option « Grès cérame 60×60 » ; **Recevoir le code par** « E-mail » ; **Recevoir mon code** ; tapez le code
   reçu ; **Confirmer**.

**Résultat attendu** : la décision passe **Validé** des deux côtés, avec l'option retenue, la date et l'heure ; elle
figure dans l'onglet **Historique** de Paul.

> **Si le service SMS / WhatsApp n'est pas activé** : choisissez toujours « E-mail » dans **Recevoir le code par**.

- [ ] **R2** — Décision client validée par code.

### Scène R3 — Un avenant : deux prises en plus

**Pourquoi** : tout travail supplémentaire passe par un avenant chiffré, accepté par le client **puis** approuvé par la
finance ; il est suivi et facturé **à part** : le montant du contrat ne change jamais.

**Qui** : Samuel, Paul, puis Grâce. **Où** : fiche du projet, onglet **Avenants** ; espace client, **Validations**.

**Méthode**

1. Samuel : **Nouvel avenant** :

| Champ | Valeur | |
| --- | --- | --- |
| Lot | « ELEC » | |
| Titre | `Deux prises supplémentaires au séjour` | ★ |
| Description | `Demande de Paul lors de la visite` | |
| Motif | « Demande client » | |
| Impact délai (jours) | `1` | |
| Lignes chiffrées | bouton **Ligne chiffrée** : Désignation `Prise 16 A encastrée`, Quantité `2`, Unité `u`, Prix unitaire (FCFA) `22500` | |

   Le **Total des lignes** affiche 45 000 FCFA. **Créer**.

2. Samuel : sur la ligne de l'avenant, **Soumettre au client**, **Confirmer**.
3. Paul : **Validations**, onglet **Avenants** : **Approuver**, **Recevoir mon code**, tapez le code, **Approuver**.
4. Grâce : sur l'avenant, **Approuver (finance)**, **Confirmer**.

**Résultat attendu** : l'**impact coût** de l'avenant vaut **45 000** (calculé à partir des lignes) ; statuts
successifs **Brouillon → Soumis → Approuvé client → Approuvé** ; le **montant du contrat** reste inchangé
(« avenants non inclus ») ; **Avenants approuvés** passe à **45 000 FCFA**, affiché à part chez Paul (**Tableau de
bord**, **Finances**, **Passeport**, site et application GLOBUS Client) et dans la fiche du projet (avec le **Total
contrat et avenants**) ; la fin prévue du projet est décalée d'un jour ; le **Reste à appeler** ne porte que sur le
contrat (l'avenant est facturé à part, scène F4).

> **Contrôle** : Samuel ne voit pas **Approuver (finance)** (réservé à la finance et à la direction).

- [ ] **R3** — Avenant chiffré, accepté par le client, approuvé, suivi à part du montant du contrat.

### Scène R4 — Le premier appel de fonds et son encaissement

**Pourquoi** : Paul paie par étapes. Sans paiement en ligne activé, l'encaissement se saisit avec sa **preuve**, et une
**autre personne** le confirme.

**Qui** : Rachel, Paul, Grâce. **Où** : *Finance › Facturation*, onglet des appels de fonds ; espace client,
**Finances**.

**Méthode**

1. Rachel : **Nouvel appel de fonds** :

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | ★ |
| Jalon | « Acompte à la signature » (30 %, jalon du contrat de travaux, scène B7) | |
| Libellé | `Appel de fonds n° 1 — démarrage des fondations` | ★ |
| Montant | `5000000` | ★ |
| Devise | « FCFA (XAF) » | |
| Date d'échéance | dans 10 jours | |

   **Créer**. Rachel essaie **Émettre** : refus (« Double regard : l'appel de fonds est émis par une autre personne
   que celle qui l'a préparé ») ; Grâce : sur la ligne, **Émettre**, **Confirmer** (facture d'appel de fonds
   définitive, PDF et QR).

2. Paul : **Finances** : l'appel apparaît avec **Payer**. Cliquez sur **Payer** :
   - **si le paiement en ligne n'est pas activé** : la fenêtre **Paiement en ligne** affiche « Aucun moyen de paiement
     en ligne n'est activé. Contactez votre chargé d'affaires. » ; cliquez sur **Annuler** ;
   - **s'il est activé** : voir l'annexe A.

3. Rachel : sur l'appel de fonds, **Enregistrer un encaissement** :

| Champ | Valeur | |
| --- | --- | --- |
| Montant encaissé | `2000000` (paiement partiel) | |
| Mode de règlement | « Virement bancaire » | ★ |
| Date de valeur | hier | ★ |
| Référence | `VIR-CLIENT-0001` (obligatoire sauf pour les espèces) | |
| Preuve de l'encaissement | le PDF « Avis de crédit » | ★ |
| Notes | `Premier versement de Paul` | |

   **Enregistrer un encaissement**.

4. Rachel : *Finance › Finances*, onglet **Paiements**, ouvrez l'encaissement **À approuver** :
   **Approuver** est refusé (« Séparation des tâches… »).

5. Grâce : même encaissement, **Approuver**.

**Résultat attendu** : après Grâce, l'encaissement est **Réussi**, un **reçu PDF** est généré, l'appel de fonds passe
**Partiellement payé** (reste 3 000 000) ; Paul voit le paiement et peut télécharger son reçu dans **Finances**.

> **Contrôles** : une date de valeur dans le futur, un montant supérieur au reste dû ou une référence déjà utilisée sont
> refusés.

- [ ] **R4** — Appel de fonds, encaissement hors plateforme, double regard, reçu client.

### Scène R5 — Paul écrit à l'équipe

**Qui** : Paul, puis Samuel. **Où** : espace client, **Messagerie** ; ERP, *Communication › Messagerie*.

**Méthode**

1. Paul ouvre la conversation de son projet et écrit `Peut-on visiter samedi ?` ; Samuel répond
   `Oui, 10 h sur le chantier` et joint une photo et le PDF « Plan RDC » (trombone).

2. Paul quitte la messagerie (menu **Tableau de bord**), puis y revient ; il recharge aussi la page.
3. Même chose dans l'application **GLOBUS Client** (onglet **Messages**).

**Résultat attendu** : le message arrive chez Samuel (notification), la réponse chez Paul, en temps réel ; la photo
s'affiche en vignette (toucher : plein écran avec zoom) et le PDF s'ouvre en **aperçu** dans la plateforme ; au
retour, la conversation est **toujours là** (sur ordinateur, la dernière conversation ouverte se rouvre) : il n'est
jamais nécessaire de refaire **Nouvelle conversation**.

- [ ] **R5** — Messagerie client ↔ équipe.

### Scène R6 — Le dossier Tranquillité

**Pourquoi** : les pièces foncières et administratives sont centralisées et vérifiées ; le client les consulte.

**Qui** : Samuel, puis Paul. **Où** : fiche du projet, onglet **Tranquillité** ; espace client, **Dossier
Tranquillité**.

**Méthode**

1. Samuel : **Nouvelle pièce** :

| Champ | Valeur | |
| --- | --- | --- |
| Catégorie | « Permis » | ★ |
| Titre | `Permis de bâtir` | ★ |
| Numéro de référence | `PB-TEST-2026-001` | |
| Autorité | `Communauté urbaine de Douala` | |
| Statut | « En vérification » | |
| Date de délivrance | il y a 1 mois | |
| Visible par le client | coché | |

   **Créer** ; puis sur la ligne, **Vérifier** : **Statut** ★ « Vérifié », **Notes** `Original consulté en mairie` ;
   **Vérifier**.

2. Paul : **Dossier Tranquillité**.

**Résultat attendu** : la pièce passe **Vérifié** ; Paul la voit avec son statut.

- [ ] **R6** — Dossier Tranquillité partagé.

---

## Chapitre 13 — Les comptes du chantier (finances)

*Rachel tient la trésorerie : compte bancaire, petite caisse, relevé, factures client et suivi du budget. Chaque
mouvement d'argent est vu par deux personnes.*

### Scène F1 — Le compte bancaire de l'entreprise

**Qui** : Rachel. **Où** : *Finance › Finances*, onglet **Banque**, bouton **Nouveau compte**.

**Méthode**

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `TEST Compte courant` | ★ |
| Banque | `TEST Banque` | |
| Numéro de compte | `CM21 0000 0000 0000 0000 0000 000` (numéro fictif) | |
| Devise | « FCFA (XAF) » | |
| Type | « Banque » | |
| Actif | coché | |

**Créer**.

**Résultat attendu** : le compte apparaît ; en le rouvrant, le numéro n'est **jamais** réaffiché en clair (seulement
masqué).

- [ ] **F1** — Compte bancaire créé, numéro protégé.

### Scène F2 — La petite caisse d'Ernest

**Pourquoi** : les petites dépenses en espèces (carburant, transport) sont déclarées par le gestionnaire de la caisse,
avec le reçu, puis validées par la finance ; elles entrent dans le budget du projet.

**Qui** : Rachel, Grâce, puis Ernest. **Où** : *Finance › Finances*, onglet **Petites caisses** ; pour Ernest, *Finance ›
Ma petite caisse* (ou application **GLOBUS Terrain**, **Logistique › Ma petite caisse**).

**Méthode**

1. Rachel : **Nouvelle caisse** :

| Champ | Valeur | |
| --- | --- | --- |
| Nom | `Caisse Villa Mballa` | ★ |
| Projet | « TEST — Villa Mballa » | |
| Chantier | « Parcelle Bonamoussadi » | |
| Gestionnaire | « Ernest TEST-TCHOUA » | |
| Plafond | `200000` | |
| Actif | coché | |

   **Créer**, puis ouvrez la caisse.

2. Rachel : **Déclarer un mouvement** ; fenêtre **Mouvement de caisse** : **Type** ★ « Entrée (réapprovisionnement) »,
   **Montant** ★ `100000`, **Objet** ★ `Approvisionnement initial`, **Date de l'opération** ★ aujourd'hui ;
   **Enregistrer**. Rachel essaie de le **Valider** : refus (« Séparation des tâches : validation par une autre
   personne ») ; Grâce ouvre la caisse et clique sur **Valider**.

3. Ernest : reconnectez-vous ; le menu **Finance › Ma petite caisse** apparaît (il n'a pourtant aucun droit finance).
   **Déclarer un mouvement** : **Type** « Sortie (dépense) », **Montant** `15000`, **Objet** `Carburant groupe
   électrogène`, **Catégorie** « Carburant », **Lot** « GO », **Date de l'opération** aujourd'hui, **Reçu** ★
   (obligatoire pour une sortie) la photo d'un ticket ; **Enregistrer**. Ernest ne voit aucun bouton **Valider**.

4. Rachel : onglet **Petites caisses**, la caisse, sur la sortie d'Ernest : **Valider**.

**Résultat attendu** : solde de la caisse **85 000** ; la dépense de 15 000 apparaît dans l'onglet **Budget** du projet,
catégorie « Frais généraux », lot GO. Moussa, qui n'est gestionnaire d'aucune caisse, n'a pas l'entrée **Ma petite
caisse**.

> **Contrôles** : une sortie sans reçu, ou supérieure au solde (« Solde de caisse insuffisant »), est refusée ; une
> entrée qui ferait dépasser le plafond aussi (« Plafond de caisse dépassé »).

- [ ] **F2** — Petite caisse : déclaration par le gestionnaire, reçu, double regard, imputation au budget.

### Scène F3 — Le relevé bancaire et le rapprochement

**Pourquoi** : chaque paiement enregistré doit se retrouver sur le relevé de la banque.

**Qui** : Rachel. **Où** : *Finance › Finances*, onglet **Banque**, le compte `TEST Compte courant`.

**Avant** : préparez le fichier `releve-test.csv` (annexe D), en remplaçant les dates par celles où vous avez joué les
scènes H14, E4, R4 et S12 :

```
date;libellé;référence;montant
JJ/MM/AAAA;Virement Quincaillerie du Wouri;VIR-TEST-0001;-490000
JJ/MM/AAAA;Versement Paul Mballa etudes;VIR-ETUDES-0001;3577500
JJ/MM/AAAA;Versement Paul Mballa;VIR-CLIENT-0001;2000000
JJ/MM/AAAA;Virement Electricite Akwa;VIR-TEST-0002;-831915
JJ/MM/AAAA;Frais de tenue de compte;FRAIS-10;-5000
```

**Méthode**

1. Bloc **Importer un relevé** : déposez le fichier dans **Relevé bancaire CSV**, cliquez sur **Importer et rapprocher**.
2. Filtre « Non rapprochées » : il ne reste que les frais de tenue de compte.
3. Réimportez le même fichier.

**Résultat attendu** : message « 5 ligne(s) importée(s) · 4 rapprochée(s) automatiquement · 0 doublon(s) ignoré(s) »
(même référence et même montant que les paiements) ; au second import : « 0 ligne(s) importée(s) · … · 5 doublon(s)
ignoré(s) ».

- [ ] **F3** — Relevé importé, rapprochement automatique, doublons écartés.

### Scène F4 — Facturer l'avenant à Paul

**Qui** : Rachel, puis Grâce, puis Paul. **Où** : *Finance › Facturation*, onglet des factures clients, **Nouvelle
facture**.

**Méthode**

1. Rachel :

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | |
| Type | « Facture » | |
| Titre | `Avenant n° 1 — deux prises supplémentaires` | ★ |
| Date d'émission | aujourd'hui | ★ |
| Date d'échéance | dans 15 jours | |
| Taux de TVA | `19.25` | |
| Lignes | une ligne : Désignation ★ `Prise 16 A encastrée`, Unité `u`, Quantité ★ `2`, Prix unitaire ★ `22500` | ★ |

   **Créer**.

2. Rachel : **Proforma (PDF)** (tampon « PROFORMA ») ; puis Grâce : **Valider (facture définitive)**, **Confirmer**
   (le PDF définitif est produit, avec son QR d'authenticité) ; Rachel : **Envoyer au client**, **Confirmer**.

3. Paul : **Finances** : la facture apparaît (45 000 HT, TVA 8 662,50, TTC 53 662,50), avec **Payer** et le PDF.

4. Grâce : sur la facture, **Émettre une facture d'avoir** : **Montant** `5000`, **Motif** `Geste commercial` ;
   **Enregistrer**. Paul : **Finances**, bloc **Factures d'avoir** : l'avoir et son PDF « FACTURE D'AVOIR ».

**Résultat attendu** : facture **Brouillon → Validé → Envoyé** ; Paul est notifié par e-mail ; une facture validée
n'est plus modifiable (seul un avoir peut la corriger). Le PDF respecte l'annexe H (TVA « 19,25 % », « Arrêtée la
présente facture à la somme de : Cinquante-trois mille six cent soixante-deux francs CFA »).

- [ ] **F4** — Facture client émise et visible par le client.

### Scène F5 — Le suivi du budget

**Qui** : Grâce. **Où** : fiche du projet, onglet **Budget** ; *Finance › Finances*, onglet **Pilotage**.

**Méthode** : lisez, par catégorie, le budget, l'**Engagé** (bons de commande, marchés), le **Consommé** (dépenses
validées) et le **Reste à engager**.

**Résultat attendu** : on retrouve le ciment (matériaux), le marché d'électricité (sous-traitance), le carburant (frais
généraux) ; la trésorerie du **Pilotage** reflète les encaissements et décaissements des chapitres 9 à 13.

- [ ] **F5** — Budget et trésorerie cohérents avec l'histoire.

### Scène F6 — Une prévision de trésorerie

**Qui** : Rachel. **Où** : *Finance › Finances*, onglet **Prévisions**, **Nouvelle prévision**.

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | |
| Libellé | `Appel de fonds n° 2 attendu` | ★ |
| Sens | « Entrée » | ★ |
| Montant | `8000000` | |
| Date prévue | dans 45 jours | ★ |
| Probabilité | `80` | |

**Créer**.

**Résultat attendu** : la prévision s'ajoute à la courbe de trésorerie prévisionnelle (onglet **Pilotage**).

- [ ] **F6** — Prévision de trésorerie prise en compte.

---

## Chapitre 14 — Les hommes et la sécurité (RH et QHSE)

*Congés, paie, équipements de protection, causerie sécurité, inspection, incident : chaque circuit est tracé et vérifié
par une autre personne que celle qui l'a lancé.*

### Scène Q1 — Moussa demande un jour de congé

**Qui** : Moussa (application **GLOBUS Terrain**), puis Rachel (ERP). **Où** : **Personnel › Mon espace RH**, bloc
**Mes congés** ; ERP, *RH et QHSE › Ressources humaines*, onglet **Congés**.

**Méthode**

1. Moussa : **Mes congés › Demander** ; **Type** « Congés payés », dates de début et de fin dans 15 jours (une journée),
   **Motif (facultatif)** `Mariage d'un proche` ; **Envoyer la demande**.

2. Rachel : onglet **Congés**, sur la demande : **Accorder**, **Confirmer**.

**Résultat attendu** : la demande passe **Approuvé** ; Moussa le voit dans **Mes congés** et reçoit une notification.

- [ ] **Q1** — Demande de congé depuis le terrain, décision RH.

### Scène Q2 — La paie du mois

**Pourquoi** : la paie part des fiches (T1) et des pointages validés (T4) ; elle n'est validée qu'avec des paramètres
de cotisation revus par l'expert-comptable.

**Qui** : Rachel, puis Grâce. **Où** : *Ressources humaines*, onglets **Paramètres de paie** et **Paie**.

**Méthode**

1. Rachel : onglet **Paie**, **Nouvelle paie** : **Période** ★ `AAAA-MM` (le mois en cours, ex. `2026-10`) ;
   **Créer**, puis ouvrez la paie et cliquez sur **Recalculer**.

2. Lisez les totaux **Brut**, **Retenues salariales**, **Charges patronales**, **Net à payer** et la ligne de chaque
   salarié (Ernest au mois, Moussa au jour pointé).

3. Sur la ligne de Moussa : **Ajuster** ; **Primes** `5000`, **Motif** ★ `Prime de salissure` ; **Enregistrer** : le net
   est recalculé.

4. Grâce : **Valider (finance)**.
   - **Si les paramètres n'ont pas été revus** (bandeau « Paramètres de paie non revus ») : la plateforme **refuse**
     (« Paramètres de paie non revus par le cabinet comptable »). C'est le comportement attendu : ne cochez la case
     **Paramètres revus et validés par un expert-comptable** (onglet **Paramètres de paie**) que lorsque c'est vrai.
     Pour la recette, arrêtez la scène ici.
   - **Si les paramètres ont été revus** : la paie passe **Validé**, les bulletins PDF sont produits.

5. (Paramètres revus seulement) Rachel : **Marquer payée** ; **Mode de paiement** « Virement bancaire »,
   **Référence** `PAIE-TEST-10`, **Preuve (ordre de virement, état signé)** ★ un PDF ; **Confirmer**. Moussa ouvre
   **Mon espace RH › Mes bulletins de paie** et télécharge son bulletin.

**Résultat attendu** : calcul cohérent avec les pointages ; aucune validation sans paramètres revus ; la personne qui
a calculé la paie ne peut pas la valider (double regard) ; chaque bulletin PDF porte un QR d'authenticité ; bulletin
visible du seul salarié concerné.

- [ ] **Q2** — Paie calculée, ajustée, validation protégée.

### Scène Q3 — Les casques du chantier

**Qui** : Ernest (rôle Responsable QHSE). **Où** : *RH et QHSE › QHSE*, onglet **EPI**.

**Méthode**

1. **Nouvel EPI** : **Nom** ★ `Casque chantier blanc`, **Type** ★ « Casque », **Taille** `Unique`, **Durée de vie
   (jours)** `730`, **Norme** `EN 397`, **Actif** coché ; **Créer**.

2. **Remettre un EPI** : **EPI** ★ « Casque chantier blanc », **Employé** « Moussa TEST-BELLO », **Projet** « TEST —
   Villa Mballa », **Quantité** `1`, **Remis le** aujourd'hui ; **Créer**.

3. Sur la remise : **Retour**, **Confirmer** (fin de mission simulée).

**Résultat attendu** : la remise apparaît au nom de Moussa, puis marquée rendue.

- [ ] **Q3** — Catalogue et remise d'EPI tracés.

### Scène Q4 — Le quart d'heure sécurité

**Qui** : Ernest. **Où** : *QHSE*, onglet **Quarts d'heure**, bouton **Quart d'heure**.

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | ★ |
| Site | « Parcelle Bonamoussadi » | |
| Date | aujourd'hui | |
| Durée (min) | `15` | |
| Thème | `Travail en tranchée` | ★ |
| Contenu | `Blindage, accès par échelle, distance des déblais` | |
| Participants (salariés) | « Moussa TEST-BELLO » | |

**Enregistrer**.

**Résultat attendu** : la causerie est enregistrée avec ses participants (indicateur de l'onglet **Indicateurs**).

- [ ] **Q4** — Causerie sécurité enregistrée.

### Scène Q5 — L'inspection sécurité

**Qui** : Ernest. **Où** : *QHSE*, onglets **Grilles** puis **Inspections**.

**Méthode**

1. **Nouvelle grille** : **Nom** ★ `Sécurité fouilles`, **Catégorie** « Sécurité », **Liste de contrôle** : ajoutez
   `Blindage en place`, `Échelle d'accès`, `Port du casque`, **Actif** coché ; **Créer**.

2. **Nouvelle inspection** : **Grille** « Sécurité fouilles », **Projet** ★ « TEST — Villa Mballa », **Chantier**
   « Parcelle Bonamoussadi », **Catégorie** « Sécurité », **Date d'inspection** aujourd'hui ; **Créer**.

3. Dans l'inspection : « Conforme » pour les deux premiers points, « Non conforme » pour `Port du casque`, avec un
   **Constat** `Un ouvrier sans casque` et une photo ; **Constats généraux** `Rappel fait sur place` ;
   **Terminer l'inspection**.

**Résultat attendu** : l'inspection est **Terminé** avec un score (2 conformes sur 3) ; le point non conforme est prêt à
donner lieu à une action corrective.

- [ ] **Q5** — Inspection menée avec la grille.

### Scène Q6 — Un presque-accident, de la déclaration à la clôture

**Pourquoi** : un incident ne se clôt qu'après l'analyse des causes et la vérification de chaque action par une autre
personne que son responsable.

**Qui** : Ernest, Moussa, Samuel. **Où** : *QHSE*, onglet **Incidents** ; application **GLOBUS Terrain**, **QHSE**.

**Méthode**

1. Ernest : **Déclarer un incident** :

| Champ | Valeur | |
| --- | --- | --- |
| Projet | « TEST — Villa Mballa » | ★ |
| Site | « Parcelle Bonamoussadi » | |
| Nature | « Presque-accident » | ★ |
| Gravité | « Moyenne » | ★ |
| Survenu le | aujourd'hui, 10:30 | ★ |
| Lieu précis | `Fouille nord` | |
| Titre | `Chute d'un parpaing près de la fouille` | ★ |
| Description des faits | `Un parpaing est tombé de la pile, personne touché` | |
| Mesures immédiates | `Zone balisée, pile refaite` | |
| Photos | une photo | |

   **Déclarer l'incident**.

2. Ernest essaie **Clôturer** : refus (« Analyse des causes requise avant clôture »).
3. Ernest : **Analyse des causes** : **Cause racine** ★ `Pile trop haute sur sol meuble`, **Jours d'arrêt** `0` ;
   **Enregistrer**.

4. Ernest : **Action corrective** : **Titre** ★ `Limiter les piles à 1,20 m`, **Responsable** ★ « Moussa TEST-BELLO »,
   **Date d'échéance** ★ dans 3 jours ; **Enregistrer**.

5. Moussa (application, **QHSE**, bloc des actions) : **Démarrer**, puis **Terminer avec preuve** : **Ce qui a été
   fait** `Piles refaites et marquées`, une photo.

6. Moussa essaie de vérifier sa propre action dans l'ERP : refus (« Vérification par une personne distincte du
   responsable »).

7. Samuel : ouvre l'action (onglet **Actions correctives**), **Vérifier**, **Valider la vérification**.
8. Ernest : sur l'incident, **Clôturer**, confirmez.

**Résultat attendu** : incident **Clos** ; l'action **Vérifié** ; tout l'historique est conservé.

> **Pour informer Paul** (facultatif) : sur l'incident, **Informer le client**, **Résumé pour le client** ★ (10
> caractères minimum, sans nom de personne) ; Paul le voit dans son espace.

- [ ] **Q6** — Incident déclaré, analysé, corrigé, vérifié, clos.

---

## Chapitre 15 — Grâce pilote depuis son téléphone (l'application GLOBUS Direction)

*La direction n'a pas toujours un ordinateur : l'application Direction réunit les indicateurs, les validations et le
rapport hebdomadaire.*

### Scène D1 — Le tableau de bord

**Qui** : Grâce, téléphone, application **GLOBUS Direction** (connexion avec e-mail, mot de passe et code à 6 chiffres :
la double authentification est obligatoire pour la direction). **Où** : application Direction, onglet **Pilotage** (en bas de l'écran).

**Méthode** : faites défiler le tableau de bord.

**Résultat attendu** : **Chantiers actifs** (au moins la Villa Mballa), **Jalons en retard**, **Incidents QHSE graves**,
**Tickets SAV ouverts**, **Approbations en attente**, les montants **CA signé**, **Facturé**, **Créances à encaisser**,
**Dettes fournisseurs**, la **Trésorerie prévisionnelle (6 mois)** (avec la prévision de la scène F6), **Marges par
chantier**, **Livraisons attendues (7 jours)**. Les chiffres sont ceux de l'ERP web.

- [ ] **D1** — Tableau de bord direction cohérent avec l'ERP.

### Scène D2 — Valider depuis le téléphone

**Pourquoi** : une validation urgente ne doit pas attendre le retour au bureau.

**Qui** : Ernest (ERP ou application Terrain), puis Grâce (application Direction). **Où** : application Direction, onglet **Validations** (en bas de l'écran).

**Méthode**

1. Ernest crée une nouvelle demande d'achat comme à la scène H2, mais de **6 000 000 FCFA** (par exemple 1 000 sacs à
   6 000), justification `Stock pour l'élévation`, **Soumettre immédiatement** coché. Au-delà de 5 000 000, la direction
   intervient (rappel en tête du chapitre 9).

2. Samuel approuve le niveau 1 (comme à la scène H3) ; au-delà de 5 000 000, le niveau 2 revient à la direction (et
   non à l'acheteur).

3. Grâce : onglet **Validations** : la demande apparaît dans **Commandes à approuver** ; ouvrez-la, **Approuver**.
4. Regardez aussi les autres blocs : **Paiements à approuver**, **Situations à valider**, **Congés à décider**,
   **Actions à vérifier**, **Décisions client en attente** (vides si tout a été traité).

**Résultat attendu** : la demande passe **Approuvée** ; l'ERP web affiche la même décision, avec l'heure et le nom de
Grâce.

- [ ] **D2** — Approbation mobile, séparation des tâches respectée.

### Scène D3 — Le rapport de direction

**Qui** : Grâce. **Où** : **Plus › Rapport de direction**.

**Méthode** : **Générer** ; ouvrez le rapport de la semaine, puis **Rapport PDF**.

**Résultat attendu** : un rapport en sections **Finance**, **Chantiers**, **Commercial**, **Contrôles et SAV**,
**Perspectives**, et son PDF.

> Le rapport est calculé par la plateforme à partir des chiffres de la semaine : il ne dépend d'aucun service externe.

- [ ] **D3** — Rapport hebdomadaire généré.

### Scène D4 — La sécurité des comptes

**Qui** : Grâce. **Où** : **Plus › Sécurité** et **Sessions actives**.

**Méthode** : lisez **Comptes actifs**, **Double authentification**, **Échecs de connexion (24 h)**, **Sans double
authentification**, **Alertes de sécurité récentes**.

**Résultat attendu** : les onze comptes de l'histoire ; la liste **Sans double authentification** ne contient aucun
compte de la direction ni de la finance.

- [ ] **D4** — Supervision de la sécurité depuis le mobile.

---

# Livre VI — Autour de la maison

## Chapitre 16 — Se parler (notifications, messagerie, appels, agenda)

### Scène N1 — Choisir ses notifications

**Qui** : Samuel. **Où** : *Administration › Mon compte*, onglet **Notifications**.

**Méthode** : pour une famille d'événements (par exemple les achats), décochez l'e-mail et gardez la notification dans
l'application ; enregistrez. Faites ensuite créer une demande d'achat par Ernest (comme en H2).

**Résultat attendu** : Samuel reçoit la notification dans l'application (cloche), **pas** l'e-mail. Remettez ensuite
l'e-mail.

> **Si WhatsApp / SMS ne sont pas activés**, ces canaux sont indiqués comme indisponibles : seuls l'e-mail, la cloche et
> le push du téléphone s'appliquent (annexe A).

- [ ] **N1** — Préférences de notification respectées.

### Scène N2 — La messagerie d'équipe

**Qui** : Samuel, Ernest, Linda. **Où** : *Communication › Messagerie* (ou **Échanges › Messagerie** sur le téléphone).

**Méthode** : Samuel crée une conversation de groupe `Villa Mballa — équipe` avec Ernest et Linda ; il envoie un
message et une photo ; Ernest répond depuis le téléphone.

**Résultat attendu** : messages en temps réel ; la photo s'affiche en vignette et s'agrandit au clic ; un PDF joint
s'ouvre en aperçu ; une note audio se lit sur place ; indicateur de lecture ; en quittant puis en revenant sur la
messagerie (ordinateur et téléphone), la conversation est toujours listée ; Paul **ne voit pas** cette conversation
interne.

- [ ] **N2** — Messagerie interne.

### Scène N3 — Un appel

**Qui** : Samuel, puis Ernest. **Où** : **Appels** (ERP ou application Terrain).

**Méthode** : Samuel appelle Ernest (audio) ; Ernest décroche sur son téléphone ; raccrochez au bout de 30 secondes.
Refaites un appel sans décrocher.

**Résultat attendu** : l'appel s'établit ; le second apparaît **manqué** dans l'historique d'Ernest.

- [ ] **N3** — Appels internes.

### Scène N4 — La visite de samedi à l'agenda

**Qui** : Samuel, puis Paul. **Où** : *Projets › Agenda* ; espace client, **Mes rendez-vous** (site et application
GLOBUS Client).

**Méthode** : Samuel crée l'événement `Visite de chantier avec Paul`, samedi 10:00–11:00, projet « TEST — Villa
Mballa », participants Paul et Ernest ; **Créer**.

**Résultat attendu** : l'événement est dans l'agenda d'Ernest et dans celui de Paul (invitation reçue par e-mail).

- [ ] **N4** — Agenda partagé avec le client.

### Scène N5 — Paul demande un rendez-vous

**Pourquoi** : le client n'attend pas qu'on l'appelle : il propose un créneau, l'équipe du projet le confirme ou en
propose un autre.

**Qui** : Paul, puis Samuel. **Où** : espace client, **Mes rendez-vous** (ou application **GLOBUS Client**, **Plus ›
Mes rendez-vous**) ; ERP, *Projets › Agenda*.

**Méthode**

1. Paul : **Demander un rendez-vous** :

| Champ | Valeur | |
| --- | --- | --- |
| Objet | `Choix des finitions` | ★ |
| Type | « Rendez-vous (bureau GLOBUS) » | |
| Durée | « 1 heure » | |
| Date et heure souhaitées | dans 3 jours, 10:00 | ★ |
| Lieu | `Bureau GLOBUS` | |
| Message | `Je souhaite voir les échantillons de carrelage.` | |

   **Envoyer la demande**.

2. Samuel (notifié : « Demande de rendez-vous : Choix des finitions ») ouvre l'événement dans l'agenda et clique sur
   **Confirmer le rendez-vous**.

3. Paul ouvre le rendez-vous, clique sur **Déplacer** et choisit le lendemain à la même heure ; puis Samuel le
   confirme de nouveau.

**Résultat attendu** : après l'envoi, le rendez-vous apparaît chez Paul avec « En attente de confirmation par l'équipe
du projet » (statut **À confirmer**) ; Samuel et le chef de projet sont notifiés ; après **Confirmer**, Paul reçoit
« Rendez-vous confirmé : Choix des finitions » (heure locale) et le statut passe **Confirmé** ; un nouveau créneau
proposé par Paul repasse **À confirmer** et prévient l'équipe.

> **Contrôles** : Paul ne peut pas confirmer lui-même ; un créneau passé ou dans moins d'une heure est refusé ; sans
> chef de projet ni conducteur de travaux sur le projet, la demande est refusée avec un message clair.

- [ ] **N5** — Demande de rendez-vous du client, confirmation et nouveau créneau.

---

## Chapitre 17 — Le site web (CMS)

### Scène W1 — Un article, de la rédaction à la publication

**Qui** : le Gardien. **Où** : *Site web › Contenus (CMS)*, rubrique **Articles**, bouton **Nouveau — Articles**.

**Méthode**

1. **Titre** ★ `TEST — Bien préparer sa construction`, un résumé, un texte, une image de couverture choisie dans la
   médiathèque ; **Créer** (l'article est en **Brouillon**).

2. **Soumettre à relecture**, puis **Valider**, puis **Publier**.
3. Ouvrez le blog du site dans le profil **Visiteur**.

**Résultat attendu** : l'article n'est visible sur le site qu'après **Publier** ; ensuite **Dépublier (brouillon)** le
retire du site.

- [ ] **W1** — Circuit de publication d'un article.

### Scène W2 — Modérer le commentaire de la scène V10

**Qui** : le Gardien. **Où** : *Site web › Contenus (CMS)*, modération des commentaires.

**Méthode** : sur le commentaire laissé en V10, **Publier et répondre** ; écrivez `Merci pour votre message` ;
**Publier la réponse**.

**Résultat attendu** : le commentaire et la réponse apparaissent sous l'article.

- [ ] **W2** — Commentaire modéré.

### Scène W3 — Une redirection

**Qui** : le Gardien. **Où** : *Site web › SEO*, **Nouvelle redirection**.

**Méthode** : ancienne adresse `/test-ancienne-page`, nouvelle adresse `/contact`, type permanent ; **Créer**. Dans le
profil **Visiteur**, ouvrez `https://globus-engineering-sarl.com/test-ancienne-page`.

**Résultat attendu** : vous arrivez sur la page de contact. Supprimez ensuite la redirection.

- [ ] **W3** — Redirection active.

### Scène W4 — La médiathèque

**Qui** : le Gardien. **Où** : *Site web › Médiathèque*.

**Méthode** : envoyez une image dans le dossier `test` ; renseignez son texte alternatif ; puis **Archiver le média**.

**Résultat attendu** : l'image est utilisable dans les contenus tant qu'elle n'est pas archivée.

- [ ] **W4** — Médiathèque.

> **À ne pas faire en recette** : ne remplissez pas le champ **Message de maintenance** des paramètres du site : il
> fermerait le site public.

---

## Chapitre 18 — La sécurité

### Scène X1 — Le mot de passe oublié

**Qui** : Linda. **Où** : page de connexion, lien **Mot de passe oublié ?**.

**Méthode** : **Adresse e-mail** `votre.adresse+achat@gmail.com`, **Envoyer le lien** ; ouvrez l'e-mail, cliquez sur le
lien ; **Nouveau mot de passe** (12 caractères minimum, avec majuscule, minuscule, chiffre et caractère spécial) et
**Confirmer** ; **Enregistrer** ; reconnectez-vous.

**Résultat attendu** : connexion avec le nouveau mot de passe ; le lien ne fonctionne qu'une fois. Un mot de passe trop
simple est refusé.

- [ ] **X1** — Réinitialisation du mot de passe.

### Scène X2 — Le verrouillage après 5 échecs

**Qui** : Linda (profil **GLOBUS ACH**). **Où** : page de connexion.

**Méthode** : tapez 5 fois un mauvais mot de passe, puis le bon.

**Résultat attendu** : « Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard. » ; la connexion
redevient possible au bout de 15 minutes, ou tout de suite si le Gardien déverrouille le compte (*Administration ›
Sécurité*, ou **Déverrouiller** dans l'application Direction). L'échec apparaît dans **Échecs de connexion (24 h)**.

- [ ] **X2** — Verrouillage et déverrouillage.

### Scène X3 — Changer son mot de passe et fermer ses sessions

**Qui** : Linda. **Où** : *Administration › Mon compte*, onglets **Sécurité** puis **Sessions et appareils**.

**Méthode**

1. **Sécurité** : **Mot de passe actuel**, **Nouveau mot de passe**, **Confirmation** ; **Modifier le mot de passe**.
2. Connectez-vous aussi sur le téléphone ; dans **Sessions actives**, sur la session du téléphone, **Révoquer**.

**Résultat attendu** : le téléphone est déconnecté à sa prochaine action ; l'**Historique de sécurité** garde la trace.

- [ ] **X3** — Mot de passe et sessions maîtrisés.

### Scène X4 — Chacun chez soi

**Pourquoi** : un compte ne doit jamais ouvrir ce qui ne le concerne pas, même en tapant l'adresse à la main.

**Méthode** (chaque personnage dans son profil) :

| Qui | Adresse tapée | Attendu |
| --- | --- | --- |
| Moussa | `/erp/finances` | page refusée (accès non autorisé) |
| Martin (fournisseur) | `/erp` | renvoyé vers son extranet |
| Sylvie (sous-traitante) | `/extranet/commandes` | entrée absente : réservée aux fournisseurs |
| Paul (client) | `/erp/chantiers` | renvoyé vers son espace client |
| Jordan (commercial) | `/erp/rh` | page refusée |

- [ ] **X4** — Cloisonnement des accès.

### Scène X5 — Le journal d'audit

**Qui** : le Gardien. **Où** : *Administration › Sécurité*.

**Méthode** : filtrez sur la journée et retrouvez : la signature du marché (S8), la validation de la situation (S11),
l'approbation du paiement (H13), le verrouillage de Linda (X2).

**Résultat attendu** : chaque événement est daté, attribué à une personne, et ne peut être ni modifié ni supprimé.

- [ ] **X5** — Traçabilité complète.

---

# Épilogue

## Chapitre 19 — Le bilan et le nettoyage

### Scène Z1 — La fin du marché d'électricité

**Qui** : Samuel, Grâce, Rachel. **Où** : *Sous-traitance › Sous-traitants*, onglet **Marchés**, le marché « Électricité Villa Mballa ».

**Méthode**

1. Sylvie déclare une seconde situation avec le reste des quantités (E2 : `24`, E3 : `20`), photos, **Soumettre** ;
   Ernest fait le constat, Samuel valide, Sylvie dépose la facture, Rachel la valide (comme en S10 à S12).

2. Grâce : **Clôturer**, **Confirmer**.
3. Rachel : **Libérer la retenue** : **Montant** *(vide : tout le disponible)*, **Motif** ★ `Fin de la garantie de
   parfait achèvement` ; **Enregistrer**.

**Résultat attendu** : le marché passe **Clôturé** (refusé tant qu'une situation n'est pas soldée ou qu'un litige est
ouvert) ; la retenue est **libérée** et une facture « Libération de retenue » apparaît, bon à payer.

- [ ] **Z1** — Clôture du marché et libération de la retenue.

### Scène Z2 — L'avis de Paul

**Qui** : Paul. **Où** : espace client, **Mon avis**.

**Méthode** : donnez une note et un commentaire ; envoyez.

**Résultat attendu** : l'avis apparaît dans l'onglet **Avis client** du projet et dans la **Satisfaction client** de
l'application Direction.

- [ ] **Z2** — Avis client recueilli.

### Scène Z3 — L'exception du super administrateur

**Pourquoi** : partout, celui qui saisit ne valide pas lui-même (factures, appels de fonds, encaissements, paiements,
budgets, petite caisse, paie, congés, avenants, situations, commandes…). Seul le super administrateur peut saisir puis
valider seul ; chaque cas est tracé au journal d'audit.

**Qui** : le Gardien (profil **GLOBUS ADM**), puis Rachel. **Où** : *Finance › Finances*, onglet **Petites caisses**,
la caisse « Caisse Villa Mballa » ; *Administration › Journal d'audit*.

**Méthode**

1. Le Gardien : **Déclarer un mouvement** : **Type** « Entrée (réapprovisionnement) », **Montant** `5000`, **Objet**
   `Appoint de fin de recette`, **Date de l'opération** aujourd'hui ; **Enregistrer** ; puis, sur ce mouvement,
   **Valider**.
2. Rachel : déclarez un mouvement identique (`Appoint Rachel`), puis essayez de le **Valider** vous-même.
3. Le Gardien : *Journal d'audit*, filtre **Action** « ADMIN_SELF_APPROVAL ».

**Résultat attendu** : le mouvement du Gardien est validé par lui seul ; celui de Rachel est refusé (« Séparation des
tâches : validation par une autre personne ») et attend une autre personne ; le journal d'audit trace l'auto-validation
du Gardien.

- [ ] **Z3** — Double regard partout, sauf pour le super administrateur (tracé).

### Scène Z4 — Archiver puis restaurer un chantier

**Qui** : le Gardien. **Où** : *Projets › Chantiers*.

**Méthode**

1. **Nouveau projet** : **Nom** ★ `TEST — Projet à archiver` ; **Créer**.
2. Dans la fiche du projet, **Archiver** ; **Motif** `Projet créé pour la recette des archives` ; **Archiver**.
3. *Projets › Chantiers* : le projet n'apparaît plus ; en bas de la page, **Voir les archives** : il y figure avec la
   date, votre nom et le motif.
4. **Restaurer** ; **Motif de la restauration** `Vérification de la restauration` ; **Restaurer**.

**Résultat attendu** : le projet rouvre à l'identique et retrouve la liste des chantiers ; archivage et restauration
sont tracés au journal d'audit. (Archivez-le de nouveau pour ne pas encombrer la liste.)

- [ ] **Z4** — Archives consultables et restauration d'un chantier.

### Scène Z5 — Le tableau de bord de la recette

**Qui** : vous. **Où** : annexe E.

**Méthode** : reportez chaque case cochée ; comptez les anomalies de l'annexe C par gravité.

**Résultat attendu** : toutes les scènes jouées sont cochées ou ont une fiche d'anomalie.

- [ ] **Z5** — Bilan établi.

### Scène Z6 — Remettre la plateforme à zéro (facultatif)

**Pourquoi** : après la recette, les données « TEST » peuvent être effacées pour démarrer l'exploitation.

**Qui** : le Gardien **en personne** (c'est une suppression définitive). **Où** : *Administration › Paramètres*,
remise à zéro des données d'exploitation.

**Méthode** : faites d'abord une sauvegarde (scène P3) ; lancez la remise à zéro et confirmez avec votre code de double
authentification.

**Résultat attendu** : projets, prospects, achats, paiements de test supprimés ; le site, le CMS, la médiathèque, les
paramètres et les comptes du personnel sont conservés.

- [ ] **Z6** — Plateforme prête pour l'exploitation.

---

# Annexes

## Annexe A — Ce qui dépend d'un service non activé

Ces services s'activent dans *Administration › Paramètres*, onglet **Intégrations**, bloc **Activer les services**,
une fois les comptes ouverts chez les prestataires. **Aucun n'est nécessaire pour jouer la recette.**

| Service | Sans le service (recette actuelle) | Quand il sera activé, rejouez |
| --- | --- | --- |
| Paiement en ligne (MTN MoMo, Orange Money, carte) | « Aucun moyen de paiement en ligne n'est activé… » ; encaissement saisi avec preuve (E4, R4) | E4 et R4 avec **Payer** : le paiement arrive tout seul, **Réussi**, reçu émis |
| WhatsApp Business | bons de commande et codes envoyés par e-mail (H5, R2) | H5 avec le canal « WhatsApp », R2 avec « WhatsApp » |
| SMS | codes par e-mail | R2 avec « SMS » |
| Assistants IA | les écrans d'assistance indiquent que l'assistant n'est pas disponible ; tout le reste fonctionne | C10, V9, lecture de documents |
| Transcription vocale | **déjà active** (service interne au serveur, aucune clé à saisir) | — |

## Annexe B — Les données de l'histoire

| Élément | Valeur |
| --- | --- |
| Projet | `TEST — Villa Mballa`, site `S1-MBALLA` « Parcelle Bonamoussadi » |
| Lots | ET, GO, SO (issus du devis) et ELEC |
| Fournisseur | `TEST Quincaillerie du Wouri` (Martin) — ciment `CIM-425` à 5 200 FCFA |
| Sous-traitant | `TEST Électricité Akwa` (Sylvie) — marché 1 330 000 HT, TVA 19,25 % |
| Références de paiement | `VIR-TEST-0001` (490 000), `VIR-ETUDES-0001` (3 577 500, facture d'études), `VIR-CLIENT-0001` (2 000 000), `VIR-TEST-0002` (831 915) |
| Dépôt | `DEP-S1` |
| Zone | `Z-SEJOUR` |

## Annexe C — Fiche d'anomalie

| Rubrique | À remplir |
| --- | --- |
| N° | A-001, A-002… |
| Scène | ex. S11 |
| Qui / profil | ex. Samuel, GLOBUS CDP |
| Écran (menu et onglet) | |
| Ce que j'ai fait | les gestes, les valeurs saisies |
| Ce que j'attendais | le « Résultat attendu » de la scène |
| Ce que j'ai vu | le message exact, une capture d'écran |
| Gravité | **Bloquante** (impossible de continuer) · **Majeure** (résultat faux) · **Mineure** (gêne, libellé) |

## Annexe D — Les fichiers à préparer

Placez-les dans un dossier `Recette GLOBUS` sur l'ordinateur et sur le téléphone :

| Fichier | Sert à |
| --- | --- |
| `Plan RDC.pdf`, `Plan RDC v2.pdf` | M9, DCE (S2) |
| `Rendu façade.jpg` (une image JPG ou PNG de la villa, même une photo) | E1 |
| `Attestation d'assurance.pdf` | S1 |
| `Mémoire technique.pdf` | S4 |
| `Facture fournisseur.pdf`, `Facture sous-traitant.pdf` | H10, S12 |
| `Preuve de virement.pdf`, `Avis de crédit.pdf` | H14, R4, S12 |
| `releve-test.csv` | F3 (modèle dans la scène) |
| 3 ou 4 photos de chantier (JPG) | T5, T7, S10, Q5, Q6 |
| un fichier IFC ou RVT (facultatif) | M11 |

N'importe quel PDF d'une page convient : seul le dépôt est testé, pas le contenu.

## Annexe E — Le tableau de bord de la recette

152 scènes. Cochez « OK » ou notez le n° de la fiche d'anomalie (annexe C).

| Chapitre | Scène | Ce qui est vérifié | OK | Anomalie |
| --- | --- | --- | --- | --- |
| Chapitre 2 | **P1** | Les voyants sont relevés. | [ ] | |
| Chapitre 2 | **P2** | Le moteur est en bonne santé. | [ ] | |
| Chapitre 2 | **P3** | Sauvegarde complète faite et vérifiée. | [ ] | |
| Chapitre 2 | **P4** | Test de restauration réussi, date notée. | [ ] | |
| Chapitre 3 | **A1** | Connexion réussie, toutes les rubriques visibles. | [ ] | |
| Chapitre 3 | **A2** | Les rôles et leurs droits s'affichent. | [ ] | |
| Chapitre 3 | **A3** | Organisation fournisseur créée. | [ ] | |
| Chapitre 3 | **A4** | Organisation sous-traitant créée. | [ ] | |
| Chapitre 3 | **A5** | Fiche fournisseur créée et reliée à son organisation. | [ ] | |
| Chapitre 3 | **A6** | Produit au catalogue. | [ ] | |
| Chapitre 3 | **A7** | Fiche sous-traitant créée. | [ ] | |
| Chapitre 3 | **A8** | Équipe créée. | [ ] | |
| Chapitre 3 | **A9** | Les sept collègues sont invités. | [ ] | |
| Chapitre 3 | **A10** | Les deux partenaires sont invités. | [ ] | |
| Chapitre 3 | **A11** | Révocation, renvoi et désactivation fonctionnent. | [ ] | |
| Chapitre 3 | **A12** | Les neuf comptes sont activés ; MFA en place au moins pour Grâce et Rachel. | [ ] | |
| Chapitre 3 | **A13** | Équipe complète. | [ ] | |
| Chapitre 4 | **V1** | Le choix des cookies est respecté et modifiable. | [ ] | |
| Chapitre 4 | **V2** | Navigation impeccable sur ordinateur et téléphone. | [ ] | |
| Chapitre 4 | **V3** | La recherche fonctionne. | [ ] | |
| Chapitre 4 | **V4** | Les contenus s'affichent. | [ ] | |
| Chapitre 4 | **V5** | La demande de Paul est envoyée et accusée. | [ ] | |
| Chapitre 4 | **V6** | L'estimation est obtenue ; la demande et la note vocale sont enregistrées. | [ ] | |
| Chapitre 4 | **V7** | Le formulaire de contact fonctionne. | [ ] | |
| Chapitre 4 | **V8** | Abonnement confirmé par e-mail. | [ ] | |
| Chapitre 4 | **V9** | L'assistant répond. | [ ] | |
| Chapitre 4 | **V10** | Commentaire en attente de modération. | [ ] | |
| Chapitre 4 | **V11** | Pages légales complètes. | [ ] | |
| Chapitre 5 | **C1** | Règle d'affectation en place. | [ ] | |
| Chapitre 5 | **C2** | Le prospect est chez Jordan. | [ ] | |
| Chapitre 5 | **C3** | Dossier complet. | [ ] | |
| Chapitre 5 | **C4** | Premier contact enregistré, relance planifiée. | [ ] | |
| Chapitre 5 | **C5** | Prospect qualifié. | [ ] | |
| Chapitre 5 | **C6** | Opportunité créée. | [ ] | |
| Chapitre 5 | **C7** | Le pipeline se met à jour. | [ ] | |
| Chapitre 5 | **C8** | Études démarrées, projet créé, Paul invité, sans devis. | [ ] | |
| Chapitre 5 | **C9** | Relance close. | [ ] | |
| Chapitre 5 | **C10** | Conversations consultables et clôturables. | [ ] | |
| Chapitre 6 | **K1** | Compte de Paul activé. | [ ] | |
| Chapitre 6 | **K2** | Double authentification du client active. | [ ] | |
| Chapitre 6 | **K3** | Déconnexion et reconnexion fonctionnent. | [ ] | |
| Chapitre 6 | **K4** | Tableau de bord juste, limité au projet de Paul. | [ ] | |
| Chapitre 6 | **K5** | Toutes les pages de l'espace client s'ouvrent. | [ ] | |
| Chapitre 6 | **K6** | Application client fonctionnelle, notifications reçues. | [ ] | |
| Chapitre 7 | **M1** | Fiche projet complète. | [ ] | |
| Chapitre 7 | **M2** | Équipe formée. | [ ] | |
| Chapitre 7 | **M3** | Site créé avec son périmètre. | [ ] | |
| Chapitre 7 | **M4** | Structure du projet en place. | [ ] | |
| Chapitre 7 | **M5** | Jalons corrects. | [ ] | |
| Chapitre 7 | **M6** | Planning construit et figé. | [ ] | |
| Chapitre 7 | **M7** | Analyse des aléas fonctionnelle. | [ ] | |
| Chapitre 7 | **M9** | Circuit de validation et de publication d'un plan fonctionnel. | [ ] | |
| Chapitre 7 | **M10** | Plan consultable en aperçu filigrané seulement, original protégé. | [ ] | |
| Chapitre 7 | **M11** | Maquette publiée (ou « non testée »). | [ ] | |
| Chapitre 7 | **M12** | QR de zone imprimé. | [ ] | |
| Chapitre 7 | **M13** | Agenda et invitations fonctionnels. | [ ] | |
| Chapitre 7 | **M14** | Registre des risques fonctionnel. | [ ] | |
| Chapitre 7 | **M15** | Panneau publié. | [ ] | |
| Chapitre 7 | **E1** | Rendu 3D publié en aperçu filigrané seulement. | [ ] | |
| Chapitre 7 | **E2** | Étude validée par le client, par code. | [ ] | |
| Chapitre 7 | **E3** | Facture d'études émise, livrables rattachés. | [ ] | |
| Chapitre 7 | **E4** | Études réglées, livrables remis au client. | [ ] | |
| Chapitre 8 | **B1** | Devis des travaux juste, rattaché au projet, PDF présentable. | [ ] | |
| Chapitre 8 | **B2** | Devis envoyé. | [ ] | |
| Chapitre 8 | **B3** | Devis accepté par code. | [ ] | |
| Chapitre 8 | **B4** | Refus et révision fonctionnent. | [ ] | |
| Chapitre 8 | **B5** | Contrat établi. | [ ] | |
| Chapitre 8 | **B6** | Signature enregistrée. | [ ] | |
| Chapitre 8 | **B7** | Contrat de travaux rattaché au projet d'études (montant, budget, lots, jalons). | [ ] | |
| Chapitre 8 | **B8** | Budget de référence approuvé, séparation des tâches respectée. | [ ] | |
| Chapitre 9 | **H1** | Dépôt et article créés. | [ ] | |
| Chapitre 9 | **H2** | Demande d'achat soumise. | [ ] | |
| Chapitre 9 | **H3** | Circuit à deux niveaux et séparation des tâches respectés. | [ ] | |
| Chapitre 9 | **H4** | Bon de commande créé. | [ ] | |
| Chapitre 9 | **H5** | Commande envoyée. | [ ] | |
| Chapitre 9 | **H6** | Contre-offre et confirmation fonctionnent. | [ ] | |
| Chapitre 9 | **H7** | Expédition annoncée. | [ ] | |
| Chapitre 9 | **H8** | Réception faite, écart signalé, stock à jour. | [ ] | |
| Chapitre 9 | **H9** | Mouvements de stock et imputation des coûts corrects. | [ ] | |
| Chapitre 9 | **H10** | Facture fournisseur déposée. | [ ] | |
| Chapitre 9 | **H11** | Le rapprochement des trois pièces protège des erreurs. | [ ] | |
| Chapitre 9 | **H12** | Ordre de paiement créé. | [ ] | |
| Chapitre 9 | **H13** | Double regard fonctionnel. | [ ] | |
| Chapitre 9 | **H14** | Paiement exécuté, visible du fournisseur. | [ ] | |
| Chapitre 9 | **H15** | Notation et clôture fonctionnent. | [ ] | |
| Chapitre 9 | **H16** | Documents légaux du fournisseur gérés. | [ ] | |
| Chapitre 10 | **S1** | Sous-traitant qualifié, score correct. | [ ] | |
| Chapitre 10 | **S2** | Consultation créée avec son bordereau et son DCE. | [ ] | |
| Chapitre 10 | **S3** | Invitation et publication (avec le contrôle). | [ ] | |
| Chapitre 10 | **S4** | Offre déposée depuis l'extranet. | [ ] | |
| Chapitre 10 | **S5** | Offres scellées puis ouvertes, comparatif et évaluation. | [ ] | |
| Chapitre 10 | **S6** | Négociation à trois tours historisée. | [ ] | |
| Chapitre 10 | **S7** | Attribution réservée à la direction, prix négociés repris. | [ ] | |
| Chapitre 10 | **S8** | Signature électronique par code fonctionnelle. | [ ] | |
| Chapitre 10 | **S9** | Mobilisation et avance. | [ ] | |
| Chapitre 10 | **S10** | Situation déclarée avec preuves. | [ ] | |
| Chapitre 10 | **S11** | Constat, validation et calculs exacts. | [ ] | |
| Chapitre 10 | **S12** | Facture conforme, validée, payée. | [ ] | |
| Chapitre 10 | **S13** | Réclamation et litige menés jusqu'à la résolution. | [ ] | |
| Chapitre 10 | **S14** | Notation enregistrée. | [ ] | |
| Chapitre 11 | **T1** | Fiches employés liées aux comptes. | [ ] | |
| Chapitre 11 | **T2** | QR du chantier généré. | [ ] | |
| Chapitre 11 | **T3** | Auto-pointage par QR et géolocalisation. | [ ] | |
| Chapitre 11 | **T4** | Pointage validé. | [ ] | |
| Chapitre 11 | **T5** | Avancement saisi sur le terrain. | [ ] | |
| Chapitre 11 | **T6** | Journal soumis depuis le terrain et validé. | [ ] | |
| Chapitre 11 | **T7** | Photos publiées ou internes selon le choix. | [ ] | |
| Chapitre 11 | **T8** | Rapport vocal transcrit et validé. | [ ] | |
| Chapitre 11 | **T9** | Un seul scanner pour tous les QR du chantier. | [ ] | |
| Chapitre 11 | **T10** | Saisie hors ligne, synchronisation, arbitrage du conflit et renvoi d'un envoi refusé. | [ ] | |
| Chapitre 12 | **R1** | Cloisonnement client respecté. | [ ] | |
| Chapitre 12 | **R2** | Décision client validée par code. | [ ] | |
| Chapitre 12 | **R3** | Avenant chiffré, accepté par le client, approuvé, suivi à part du montant du contrat. | [ ] | |
| Chapitre 12 | **R4** | Appel de fonds, encaissement hors plateforme, double regard, reçu client. | [ ] | |
| Chapitre 12 | **R5** | Messagerie client ↔ équipe. | [ ] | |
| Chapitre 12 | **R6** | Dossier Tranquillité partagé. | [ ] | |
| Chapitre 13 | **F1** | Compte bancaire créé, numéro protégé. | [ ] | |
| Chapitre 13 | **F2** | Petite caisse : déclaration par le gestionnaire, reçu, double regard, imputation au budget. | [ ] | |
| Chapitre 13 | **F3** | Relevé importé, rapprochement automatique, doublons écartés. | [ ] | |
| Chapitre 13 | **F4** | Facture client émise et visible par le client. | [ ] | |
| Chapitre 13 | **F5** | Budget et trésorerie cohérents avec l'histoire. | [ ] | |
| Chapitre 13 | **F6** | Prévision de trésorerie prise en compte. | [ ] | |
| Chapitre 14 | **Q1** | Demande de congé depuis le terrain, décision RH. | [ ] | |
| Chapitre 14 | **Q2** | Paie calculée, ajustée, validation protégée. | [ ] | |
| Chapitre 14 | **Q3** | Catalogue et remise d'EPI tracés. | [ ] | |
| Chapitre 14 | **Q4** | Causerie sécurité enregistrée. | [ ] | |
| Chapitre 14 | **Q5** | Inspection menée avec la grille. | [ ] | |
| Chapitre 14 | **Q6** | Incident déclaré, analysé, corrigé, vérifié, clos. | [ ] | |
| Chapitre 15 | **D1** | Tableau de bord direction cohérent avec l'ERP. | [ ] | |
| Chapitre 15 | **D2** | Approbation mobile, séparation des tâches respectée. | [ ] | |
| Chapitre 15 | **D3** | Rapport hebdomadaire généré. | [ ] | |
| Chapitre 15 | **D4** | Supervision de la sécurité depuis le mobile. | [ ] | |
| Chapitre 16 | **N1** | Préférences de notification respectées. | [ ] | |
| Chapitre 16 | **N2** | Messagerie interne. | [ ] | |
| Chapitre 16 | **N3** | Appels internes. | [ ] | |
| Chapitre 16 | **N4** | Agenda partagé avec le client. | [ ] | |
| Chapitre 16 | **N5** | Demande de rendez-vous du client, confirmation et nouveau créneau. | [ ] | |
| Chapitre 17 | **W1** | Circuit de publication d'un article. | [ ] | |
| Chapitre 17 | **W2** | Commentaire modéré. | [ ] | |
| Chapitre 17 | **W3** | Redirection active. | [ ] | |
| Chapitre 17 | **W4** | Médiathèque. | [ ] | |
| Chapitre 18 | **X1** | Réinitialisation du mot de passe. | [ ] | |
| Chapitre 18 | **X2** | Verrouillage et déverrouillage. | [ ] | |
| Chapitre 18 | **X3** | Mot de passe et sessions maîtrisés. | [ ] | |
| Chapitre 18 | **X4** | Cloisonnement des accès. | [ ] | |
| Chapitre 18 | **X5** | Traçabilité complète. | [ ] | |
| Chapitre 19 | **Z1** | Clôture du marché et libération de la retenue. | [ ] | |
| Chapitre 19 | **Z2** | Avis client recueilli. | [ ] | |
| Chapitre 19 | **Z3** | Double regard partout, sauf pour le super administrateur (tracé). | [ ] | |
| Chapitre 19 | **Z4** | Archives consultables et restauration d'un chantier. | [ ] | |
| Chapitre 19 | **Z5** | Bilan établi. | [ ] | |
| Chapitre 19 | **Z6** | Plateforme prête pour l'exploitation. | [ ] | |

## Annexe F — Que faire si…

| Situation | Que faire |
| --- | --- |
| Un bouton est grisé | Un champ ★ manque ou une règle n'est pas remplie (ex. total des critères ≠ 100 %) : relisez la fenêtre. |
| « Séparation des tâches… » | Normal : faites l'action avec l'autre personnage indiqué dans la scène. |
| Un e-mail n'arrive pas | Regardez les **Spams** et l'onglet **Promotions** de Gmail ; attendez 2 minutes ; sinon anomalie. |
| Le code reçu est refusé | Il expire au bout de 10 minutes : **Renvoyer le code**. |
| Un menu n'apparaît pas | Le rôle du personnage ne le permet pas : vérifiez vos rôles (scène A9). |
| Le téléphone « Hors zone » | Normal si vous n'êtes pas sur la parcelle : le pointage est gardé et signalé. |
| Une liste de choix est vide | L'élément n'a pas encore été créé (ex. aucun lot avant M4) : rejouez la scène précédente. |
| Une page affiche « Une erreur est survenue » | Notez le **Détail** affiché (et la référence) dans la fiche d'anomalie, puis cliquez sur **Réessayer** ou **Recharger la page**. |
| Un envoi de l'application Terrain est « refusé » | Lisez le motif dans **Synchronisation**, puis **Renvoyer** (après mise à jour de l'application si on vous l'a demandé). |
| Après une mise à jour, l'application mobile se comporte comme avant | Désinstallez l'ancienne version, téléchargez et installez la nouvelle depuis le site (rubrique **Applications**). |

## Annexe G — La référence des formulaires

Le document `docs/FORMULAIRES.md` liste **tous** les formulaires de la plateforme (313), écran par écran, avec pour
chacun : le bouton qui l'ouvre, le titre de la fenêtre, chaque champ dans l'ordre, s'il est obligatoire, le type de
saisie (liste, date, nombre et ses limites), le texte d'aide affiché et le bouton de validation. Il est généré à partir
du code de la plateforme (`npm run doc:forms`) : il est donc toujours à jour.

## Annexe H — Contrôle des documents PDF

Chaque document produit par la plateforme (devis, facture, facture d'études, reçu, bon de commande, marché de
sous-traitance, bulletin de paie, rapport de direction, certificat de preuve, passeport du bâtiment, panneau de
chantier) doit présenter :

| Élément | Ce que l'on doit voir |
| --- | --- |
| En-tête | le **logo GLOBUS ENGINEERING** à gauche ; à droite la raison sociale, le slogan, l'adresse, le téléphone, l'e-mail et le site ; un double filet bleu et orange |
| Filigrane | le **grand logo estompé au centre de chaque page** (le texte reste parfaitement lisible) |
| Titre | le type de document (ex. « FACTURE D'ÉTUDES »), son numéro et sa date d'émission |
| Parties | le bloc **Émetteur** complet (raison sociale, activité, adresse, contacts, RCCM / NIU / capital s'ils sont renseignés dans *Site web › Contenus*, Paramètres du site, mentions légales) et le bloc du client, fournisseur, sous-traitant ou salarié (nom, adresse, téléphone, e-mail, NIU, RCCM) |
| Rubriques | objet, projet (code, nom, ville), dates (émission, échéance, validité), devise |
| Montants | lignes lisibles, totaux HT / TVA / TTC (TVA écrite « 19,25 % »), « Déjà réglé » et « Reste à payer » s'il y a eu des règlements, et le **montant en toutes lettres** (« Arrêtée la présente facture à la somme de : … francs CFA ») |
| Signatures | les cadres « Date et signature » attendus (ex. « Pour le client — Bon pour accord » et « Pour GLOBUS ENGINEERING ») |
| Pied de page | la note du document, la raison sociale et les immatriculations, « N° — page x / y » et le **QR d'authenticité** |
| QR d'authenticité | sur **tous** les documents (facture, proforma, avoir, reçu, devis, bon de commande, marché, bulletin, rapport, passeport) : scanné, il ouvre la page « Document authentique » du site avec la nature, le numéro, la date, le montant, la partie concernée (masquée) et le **statut à jour** (un document annulé est signalé « non valable ») |
| Tampon | **PROFORMA** sur une facture en brouillon, **BROUILLON** / **À APPROUVER** sur un devis ou un bon de commande non validé, **ANNULÉE** sur une facture annulée |

Un aperçu filigrané à votre nom (livrables d'études non réglés, plans sensibles) s'ajoute au grand logo central.
