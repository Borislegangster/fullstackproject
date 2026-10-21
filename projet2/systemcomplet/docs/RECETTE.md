# La Villa Mballa

## Le grand essai de la plateforme GLOBUS ENGINEERING, raconté comme une histoire

*Manuel de recette complet — de la première visite sur le site jusqu'à la garantie du bâtiment*

---

## Sommaire

- **Avant-propos** — comment lire ce livre
- **Prologue** — la maison GLOBUS et ses portes
- **Les personnages** et **le petit lexique pour les non-initiés**
- **Livre I — Les préparatifs**
  - Chapitre 1 — La veille du grand jour
  - Chapitre 2 — Le Gardien fait le tour de la maison (scènes P1 à P4)
- **Livre II — Les fondations**
  - Chapitre 3 — Le Gardien distribue les clés (A1 à A13)
- **Livre III — La rencontre**
  - Chapitre 4 — Un visiteur pousse la porte (V1 à V11)
  - Chapitre 5 — Jordan, le commercial, entre en scène (C1 à C16)
  - Chapitre 6 — Paul reçoit ses clés (K1 à K6)
- **Livre IV — Le chantier se prépare**
  - Chapitre 7 — Samuel monte le projet (M1 à M15)
  - Chapitre 8 — Le ciment de Martin (H1 à H16)
  - Chapitre 9 — Les électriciens d'Akwa (S1 à S13)
- **Livre V — La vie du chantier**
  - Chapitre 10 — Une journée avec Ernest (T1 à T12)
  - Chapitre 11 — Paul suit, décide et paie (R1 à R22, dont R8 bis)
  - Chapitre 12 — Les chiffres de Rachel et de Grâce (F1 à F9)
  - Chapitre 13 — Les hommes, la sécurité et les machines (Q1 à Q9)
  - Chapitre 14 — La directrice en déplacement (D1 à D4)
- **Livre VI — Autour de la maison**
  - Chapitre 15 — Les messages qui circulent (N1 à N5)
  - Chapitre 16 — La vitrine se refait une beauté (W1 à W7)
  - Chapitre 17 — Les portes qui doivent rester fermées (X1 à X12)
- **Épilogue** — Chapitre 18 — Le bilan (Z1 à Z4)
- **Annexes** — A : ce qui ne peut pas encore être testé · B : les données de l'histoire · C : la fiche d'anomalie ·
  D : les fichiers à préparer · E : le tableau de bord de la recette · F : que faire si…

---

## Avant-propos : comment lire ce livre

Ce document n'est pas un mode d'emploi ordinaire. C'est une histoire, celle d'une maison qui n'existe pas encore : la
**Villa Mballa**, une belle maison à étage que Monsieur Paul Mballa rêve de construire à Douala. En suivant cette maison
depuis le premier clic de Paul sur le site internet jusqu'au jour où il signale une petite fuite sous sa fenêtre, vous
allez traverser, une à une, **toutes les pièces de la plateforme GLOBUS** : le site vitrine, l'outil de gestion de
l'entreprise (l'ERP), l'espace réservé aux clients, l'espace réservé aux fournisseurs et sous-traitants (l'extranet) et
les trois applications pour téléphone.

Rien de ce qui se passe dans cette histoire n'est réel. Paul, sa villa, la quincaillerie qui livre le ciment et
l'entreprise d'électricité sont des personnages inventés. Mais les écrans, les boutons, les e-mails et les documents
que vous allez manipuler, eux, sont bien réels : c'est la plateforme de production, celle que vos clients utiliseront.
C'est tout l'intérêt de cet essai, que les informaticiens appellent une **recette** : vérifier, avant de livrer, que tout
fonctionne vraiment, de bout en bout, comme dans la vraie vie.

### Pour qui est ce livre

Pour vous, même si vous n'avez jamais travaillé dans l'informatique. Chaque geste est décrit : où regarder sur l'écran,
sur quoi cliquer, quoi écrire, et ce qui doit apparaître ensuite. Les mots techniques sont expliqués dans le petit
lexique qui suit le prologue. Si un mot vous arrête, allez y jeter un œil.

### Comment sont construits les chapitres

L'histoire est découpée en **six livres**, eux-mêmes divisés en **chapitres**, eux-mêmes composés de **scènes**. Chaque
scène correspond à un test précis et se présente toujours de la même façon :

1. **Un récit** en italique, qui raconte ce qui se passe dans l'histoire et pourquoi on le fait.
2. **Une fiche** qui indique *qui* agit (quel personnage, donc quel compte vous devez utiliser) et *où* (sur quel
   appareil, dans quel menu).
3. **Ce que vous faites** : les gestes, numérotés, dans l'ordre.
4. **Ce que vous devez constater** : le résultat attendu. Si vous voyez bien cela, le test est réussi.
5. **Une case à cocher** que vous cochez quand tout est conforme.

Chaque scène porte un **code** (par exemple *A1*, *H11* ou *R8 bis*). Ce code ne sert qu'à une chose : si quelque chose ne
se passe pas comme prévu, vous notez le code dans la fiche d'anomalie (annexe C), et tout le monde saura exactement de
quel moment de l'histoire vous parlez.

### Combien de temps cela prend-il

Comptez **trois à quatre journées** si vous êtes seul, ou deux journées si vous êtes deux. Ne vous pressez pas : une
recette faite à moitié ne protège de rien. Surtout, **suivez l'ordre des chapitres**. Chaque chapitre utilise ce que le
précédent a créé : on ne peut pas livrer du ciment sur un chantier qui n'existe pas encore, ni demander à Paul de valider
un carrelage avant qu'il ait reçu les clés de son espace client.

### Si quelque chose ne marche pas

Pas de panique. Notez ce que vous avez fait, ce que vous attendiez et ce qui s'est passé, avec une capture d'écran si
possible, sur une fiche d'anomalie (annexe C). Puis continuez l'histoire si vous le pouvez. L'annexe F, « Que faire si… »,
répond aux petits ennuis les plus courants : un e-mail qui n'arrive pas, un code refusé, une page qui reste blanche.

---

## Prologue : la maison GLOBUS et ses portes

*Imaginez la plateforme GLOBUS comme un grand immeuble au cœur de Douala. Il possède plusieurs portes, et chacune
n'ouvre que sur les pièces destinées à ceux qui la franchissent.*

**La grande vitrine du rez-de-chaussée**, c'est le **site internet** : `https://globus-engineering-sarl.com`. Tout le monde
peut y entrer, sans badge ni mot de passe. On y découvre l'entreprise, ses offres, ses réalisations, son blog, et on peut
y laisser une demande : c'est là que Paul fera son tout premier pas.

**La porte du personnel**, c'est l'**ERP**, à l'adresse `https://globus-engineering-sarl.com/erp`. C'est le bureau de
l'entreprise : on y gère les clients, les devis, les chantiers, les achats, les factures, le personnel, la sécurité… Chaque
employé n'y voit que les pièces qui correspondent à son métier. Le comptable ne voit pas le planning du grutier, et le
technicien ne voit pas la trésorerie.

**La porte des clients**, c'est l'**espace client**, à l'adresse `…/espace-client`. Paul y suivra son chantier comme on suit
la croissance d'un enfant : photos, plans, factures, décisions à prendre, messages avec son chef de projet.

**La porte des partenaires**, c'est l'**extranet**, à l'adresse `…/extranet`. Les fournisseurs (qui livrent les matériaux)
et les sous-traitants (qui réalisent une partie des travaux) y reçoivent leurs commandes, y répondent aux appels d'offres
et y déposent leurs factures.

**Une seule entrée pour toutes les portes intérieures** : la page de connexion, `…/connexion`. Selon le compte avec lequel
on s'y présente, la plateforme ouvre automatiquement la bonne porte.

Enfin, **trois applications pour téléphone Android** prolongent l'immeuble jusque sur le terrain :

- **GLOBUS Terrain**, pour le personnel du chantier (chef de chantier, magasinier, technicien…). Elle fonctionne même
  sans réseau.
- **GLOBUS Direction**, pour la direction et les responsables, qui y valident les dépenses en déplacement.
- **GLOBUS Client**, pour les clients comme Paul.

---

## Les personnages

*Toute bonne histoire a ses personnages. Les nôtres sont onze. Vous les incarnerez tous, l'un après l'autre, et parfois
deux en même temps. Chacun a son propre compte, sa propre adresse e-mail, et ses propres droits.*

| Code | Personnage | Ce qu'il fait dans l'histoire | Rôle à lui donner dans la plateforme | Adresse e-mail à utiliser |
| --- | --- | --- | --- | --- |
| **ADM** | **Vous, le Gardien des clés** | L'administrateur : vous créez les comptes et veillez sur la maison | Administrateur / DG (déjà en place) | votre adresse habituelle |
| **DIR** | **Grâce Ewane**, la directrice | Elle approuve les dépenses importantes et contrôle | Direction / Responsable | `votre.adresse+direction@gmail.com` |
| **COM** | **Jordan Nkeng**, le commercial | Il transforme la demande de Paul en contrat signé | Commercial | `votre.adresse+commercial@gmail.com` |
| **CDP** | **Samuel Fotso**, l'ingénieur chef de projet | Il pilote le chantier de la Villa Mballa | Chef de projet / Conducteur de travaux | `votre.adresse+chefprojet@gmail.com` |
| **CDC** | **Ernest Tchoua**, le chef de chantier | Il vit sur le terrain : réceptions, journal, sécurité, stock | Chef de chantier + Magasinier + Responsable QHSE | `votre.adresse+chantier@gmail.com` |
| **ACH** | **Linda Mbarga**, l'acheteuse | Elle choisit les fournisseurs et passe les commandes | Acheteur / Logistique | `votre.adresse+achat@gmail.com` |
| **FIN** | **Rachel Ndongo**, la comptable | Elle facture, paie, encaisse et gère aussi le personnel | Finance / Comptabilité + Ressources humaines | `votre.adresse+finance@gmail.com` |
| **TEC** | **Moussa Bello**, le technicien | Il intervient en SAV et pointe sur le chantier | Artisan / Technicien | `votre.adresse+technicien@gmail.com` |
| **FOU** | **Martin Kamga**, gérant de la *TEST Quincaillerie du Wouri* | Il vend et livre le ciment | Fournisseur | `votre.adresse+fournisseur@gmail.com` |
| **STT** | **Sylvie Abena**, gérante de *TEST Électricité Akwa* | Son entreprise réalise l'électricité de la villa | Sous-traitant | `votre.adresse+soustraitant@gmail.com` |
| **CLI** | **Paul Mballa**, le client | Il rêve de sa villa et la fait construire | Client (son compte se crée **tout seul**, au chapitre 5) | `votre.adresse+client@gmail.com` |

### Le petit secret des adresses « + »

*Vous vous demandez sans doute comment vous allez trouver onze adresses e-mail. Rassurez-vous : une seule boîte Gmail
suffit.*

Gmail possède une particularité très pratique : il ignore tout ce qui suit le signe **+** dans une adresse. Si votre
adresse est `jean.dupont@gmail.com`, alors un e-mail envoyé à `jean.dupont+client@gmail.com` ou à
`jean.dupont+finance@gmail.com` arrivera… dans votre boîte habituelle. Pourtant, pour la plateforme GLOBUS, ce sont des
adresses différentes, donc des personnes différentes. Dans tout ce livre, remplacez simplement `votre.adresse` par la
partie de votre adresse Gmail qui précède le `@`.

> **Attention, règle d'or.** N'utilisez **jamais** votre propre adresse (celle du Gardien) pour Paul. Si l'adresse du
> client correspond déjà à un compte existant, la plateforme rattache le projet à ce compte au lieu d'inviter un
> nouveau client, et toute l'histoire de Paul serait faussée.

> **Bon à savoir.** Paul n'est pas créé à la main. Il naît tout seul, au moment où l'entreprise crée son projet à partir
> du contrat signé. C'est exactement ce qui se passera avec vos vrais clients.

### Pourquoi tant de personnages ?

*Parce que la plateforme est prudente, comme une bonne banque.* Elle applique ce qu'on appelle la **séparation des
tâches** : personne ne peut approuver ce qu'il a lui-même demandé ou créé. Ernest demande du ciment, Grâce approuve.
Rachel prépare un paiement, Grâce le valide. Si une seule personne pouvait tout faire, une erreur ou une fraude passerait
inaperçue. Pour tester ces circuits, il faut donc plusieurs personnes différentes, et c'est pour cela que chaque
personnage possède son propre compte.

---

## Petit lexique pour les non-initiés

*Avant de partir, quelques mots de vocabulaire. Ils reviendront souvent.*

- **Navigateur** : le programme qui sert à aller sur internet (Google Chrome, Microsoft Edge, Firefox…). Ce livre prend
  l'exemple de **Google Chrome**.
- **Profil de navigateur** : un « Chrome dans le Chrome ». Chaque profil garde ses propres connexions. En créant un profil
  par personnage, vous pouvez être connecté en même temps en tant que Grâce dans une fenêtre et en tant que Rachel dans
  une autre, sans que l'une déconnecte l'autre.
- **Barre d'adresse** : la longue zone en haut de la fenêtre du navigateur où s'écrit l'adresse du site (par exemple
  `https://globus-engineering-sarl.com/erp`). Vous pouvez y taper une adresse puis appuyer sur la touche **Entrée**.
- **Menu latéral** : la colonne de rubriques à gauche de l'écran dans l'ERP, l'espace client et l'extranet. Les rubriques
  sont regroupées sous des titres (Projets, Achats et logistique, Finance…). Sur téléphone, ce menu est caché derrière
  l'icône **☰** (trois traits horizontaux) en haut à gauche.
- **Le chemin de menus** : quand ce livre écrit *Administration › Paramètres*, cela veut dire : « dans le menu de gauche,
  repérez le titre **Administration**, puis cliquez sur la rubrique **Paramètres** qui se trouve dessous ».
- **Onglet** : à l'intérieur d'une page, une rangée de titres cliquables (comme les intercalaires d'un classeur). Cliquer
  sur un onglet change le contenu affiché, sans quitter la page.
- **Bouton** : une zone colorée sur laquelle on clique pour agir (**Enregistrer**, **Envoyer**, **Approuver**…). Dans ce
  livre, les noms de boutons sont toujours écrits **en gras**, exactement comme à l'écran.
- **Champ** : une case dans laquelle on écrit ou choisit une valeur. Un astérisque rouge (`*`) à côté de son nom signifie
  qu'il est obligatoire.
- **Liste déroulante** : un champ avec une petite flèche ; on clique dessus et on choisit une valeur dans la liste qui
  apparaît.
- **Fiche** ou **panneau latéral** : quand on clique sur une ligne d'une liste, ses détails s'ouvrent, souvent dans un
  panneau qui glisse depuis la droite, avec en bas les boutons d'action.
- **Fenêtre** (ou *boîte de dialogue*) : un petit cadre qui s'ouvre par-dessus la page pour vous demander des
  informations ou une confirmation. Elle se ferme avec la croix **×** en haut à droite ou le bouton **Annuler**.
- **Notification** : un message de la plateforme. Il apparaît sous la petite **cloche** en haut à droite de l'écran, et
  parfois aussi par e-mail.
- **Notification push** : une notification qui s'affiche même quand la plateforme est fermée, en haut de l'écran du
  téléphone ou dans le coin de l'écran de l'ordinateur.
- **Double authentification** (on dit aussi **MFA**) : une seconde serrure. Après le mot de passe, la plateforme demande
  un code à 6 chiffres qui change toutes les 30 secondes et que seul votre téléphone connaît, grâce à une application
  d'authentification.
- **Application d'authentification** : une application gratuite pour téléphone (Google Authenticator ou Microsoft
  Authenticator) qui fabrique ces codes à 6 chiffres.
- **Codes de secours** : une liste de codes à usage unique, à garder précieusement, qui remplacent le téléphone si on le
  perd.
- **Code à usage unique (OTP)** : un code envoyé par e-mail pour confirmer une décision importante (accepter un devis,
  valider une décision, signer un marché). Il ne sert qu'une seule fois.
- **QR code** : un petit carré noir et blanc, rempli de motifs, que l'appareil photo d'un téléphone sait lire. Il remplace
  une adresse ou un numéro trop long à taper.
- **APK** : le fichier d'installation d'une application Android, quand elle ne vient pas du Play Store.
- **PDF** : un document prêt à imprimer, qui s'ouvre de la même façon sur tous les appareils.
- **Mode avion** : un réglage du téléphone qui coupe tout réseau. Nous l'utiliserons pour simuler un chantier sans
  couverture.
- **Statut** : l'étape où en est un dossier (brouillon, envoyé, approuvé, payé…). Il s'affiche souvent dans une petite
  pastille de couleur.
- **Actualiser** (ou *recharger*) : demander au navigateur de réafficher la page. Touche **F5** sur l'ordinateur, ou
  flèche circulaire à gauche de la barre d'adresse.

---

# Livre I — Les préparatifs

*Avant de poser la première pierre, un bon chef de chantier prépare ses outils, vérifie le terrain et range son
matériel. Faisons de même. Ce livre ne se fait qu'une fois.*

## Chapitre 1 — La veille du grand jour

### 1.1 Une décision à prendre avant tout

*Il est tard. Vous relisez une dernière fois votre plan de bataille, et une question vous arrête : que deviendra tout ce
que vous allez créer pendant l'essai ?*

L'essai se déroule sur la vraie plateforme. Le projet de Paul, ses factures, les comptes des personnages : tout cela va
réellement exister dans la base de données de l'entreprise. Les factures reçoivent de vrais numéros, et le projet prend
un vrai code. Il faut donc choisir, **avant de commencer**, entre deux chemins :

**Premier chemin : garder les traces de l'essai.** Tout ce que vous créez porte le mot « TEST » dans son nom. À la fin,
vous archivez le projet et vous désactivez les comptes (chapitre 18). L'inconvénient : les numéros utilisés pendant l'essai
(code du projet, numéros de factures) sont consommés, et vos vrais premiers clients commenceront un peu plus loin dans la
numérotation.

**Second chemin : effacer l'essai comme on efface un tableau.** À la fin, le Gardien utilise la **remise à zéro des
données d'exploitation** (*Administration › Paramètres › Système et sauvegardes*, scène Z3). Elle supprime tous les
comptes, projets et données métier, mais **conserve le site vitrine, le CMS, la médiathèque, les paramètres et les
intégrations** : le travail fait sur le site pendant l'essai n'est pas perdu. La numérotation repart à zéro et un
nouvel administrateur est invité par e-mail. C'est le chemin recommandé avant la mise en service.

> **Partir d'une base propre.** Si la plateforme contient déjà des données d'essais précédents, faites cette même
> remise à zéro **avant** de commencer : vos personnages seront les seuls comptes, et le projet de Paul portera le
> premier numéro.

- [ ] J'ai choisi mon chemin (premier ou second) et je m'y tiens.

### 1.2 Préparer les adresses e-mail

Relisez le tableau des personnages et notez sur une feuille les onze adresses, en remplaçant `votre.adresse` par la
vôtre. Ajoutez-en trois qui serviront ponctuellement : `votre.adresse+contact@gmail.com` (un visiteur qui écrit via le
formulaire de contact), `votre.adresse+news@gmail.com` (un abonné à la lettre d'information) et
`votre.adresse+erreur@gmail.com` (une invitation envoyée par erreur, que l'on annulera).

Pendant l'essai, ouvrez votre boîte Gmail dans un coin de l'écran : c'est là que vont arriver toutes les invitations,
tous les codes et toutes les notifications de tous les personnages. Si un e-mail tarde, regardez aussi dans le dossier
**Spam** (ou *Courrier indésirable*) et dans l'onglet **Promotions** de Gmail.

- [ ] Les quatorze adresses sont notées sur ma feuille.

### 1.3 Un profil de navigateur pour chaque personnage

*C'est l'astuce qui vous évitera mille déconnexions.*

Avec un seul navigateur, vous ne pouvez être connecté qu'avec un seul compte à la fois : vous connecter en tant que
Rachel déconnecterait Grâce. Les profils de Chrome règlent ce problème : chaque profil est une fenêtre indépendante, avec
ses propres connexions.

**Ce que vous faites** (dans Google Chrome, sur l'ordinateur)

1. En haut à droite de la fenêtre de Chrome, juste à gauche des trois petits points verticaux, cliquez sur le **rond**
   qui représente votre profil actuel (une photo, une initiale ou une silhouette).
2. Dans le petit cadre qui s'ouvre, cliquez sur **Ajouter** (parfois écrit **+ Ajouter un profil**).
3. Choisissez **Continuer sans compte** : inutile de lier ce profil à un compte Google.
4. Donnez-lui un nom parlant, par exemple **GLOBUS ADM**, choisissez une couleur, puis cliquez sur **Terminé**. Une
   nouvelle fenêtre Chrome s'ouvre : c'est votre profil « GLOBUS ADM ».
5. Recommencez pour chaque personnage : **GLOBUS DIR**, **GLOBUS COM**, **GLOBUS CDP**, **GLOBUS CDC**, **GLOBUS ACH**,
   **GLOBUS FIN**, **GLOBUS TEC**, **GLOBUS FOU**, **GLOBUS STT**, **GLOBUS CLI**, plus un profil **Visiteur** (quelqu'un qui
   n'est connecté à rien).
6. Choisissez des couleurs différentes : vous reconnaîtrez chaque personnage au premier coup d'œil.

**Ce que vous devez constater** : en cliquant sur le rond en haut à droite, la liste de vos douze profils apparaît, et un
clic sur l'un d'eux ouvre sa fenêtre.

> Les fenêtres de **navigation privée** partagent toutes la même session entre elles. Ne les utilisez pas pour jouer deux
> personnages à la fois.

- [ ] Mes douze profils de navigateur existent.

### 1.4 L'application d'authentification sur votre téléphone

*La plupart des personnages vont protéger leur compte par une double serrure. Les codes de cette seconde serrure
viendront tous de la même application, sur votre téléphone.*

**Ce que vous faites**

1. Sur votre téléphone, ouvrez le **Play Store** (ou l'App Store sur iPhone).
2. Cherchez **Google Authenticator** (ou **Microsoft Authenticator**) et installez-la.
3. Ouvrez-la une première fois pour vérifier qu'elle démarre. Pour l'instant, elle est vide : chaque personnage y ajoutera
   sa ligne au moment de son activation (scène A12).

- [ ] L'application d'authentification est installée.

### 1.5 Les applications GLOBUS sur un téléphone Android

*Ernest, le chef de chantier, ne travaille pas derrière un bureau. Grâce valide en déplacement. Et Paul regarde son
chantier depuis son canapé. Il leur faut les applications mobiles.*

Les trois fichiers d'installation se trouvent sur l'ordinateur de travail, dans le dossier
`G:\projet2\projet2\systemcomplet\dist\mobile\2026-10-20\` : **GLOBUS-Terrain.apk**, **GLOBUS-Direction.apk** et
**GLOBUS-Client.apk**. (Pour une version plus récente, on les retrouve sur le site GitHub du projet, rubrique *Actions*,
dans la dernière exécution réussie, tout en bas de la page, section *Artifacts*.)

**Ce que vous faites**

1. Branchez le téléphone Android à l'ordinateur avec son câble USB. Sur le téléphone, si une question apparaît, choisissez
   **Transfert de fichiers**.
2. Sur l'ordinateur, ouvrez l'Explorateur de fichiers : le téléphone y apparaît comme un disque. Copiez les trois fichiers
   `.apk` dans son dossier **Download** (ou *Téléchargements*). Sans câble, déposez-les dans votre Google Drive et
   téléchargez-les depuis le téléphone (WhatsApp refuse souvent des fichiers de cette taille).
3. Sur le téléphone, ouvrez l'application **Fichiers**, puis le dossier **Téléchargements**, et touchez
   **GLOBUS-Terrain.apk**.
4. Android affiche un avertissement sur les applications de source inconnue : touchez **Paramètres**, activez
   **Autoriser cette source**, revenez en arrière, puis touchez **Installer**.
5. Recommencez avec **GLOBUS-Direction.apk** et **GLOBUS-Client.apk**.

**Ce que vous devez constater** : trois nouvelles icônes GLOBUS apparaissent parmi les applications du téléphone. Ne les
ouvrez pas encore : leurs propriétaires n'ont pas encore de compte.

> Idéalement, utilisez **deux téléphones** : l'un pour Ernest (Terrain), l'autre pour Grâce et Paul. Un seul suffit
> toutefois, en changeant d'application selon le personnage. Les iPhone ne peuvent pas installer ces applications pour
> le moment (voir annexe A).

- [ ] Les trois applications sont installées sur le téléphone.

### 1.6 La boîte à outils : les fichiers de l'histoire

*Paul enverra des photos de son terrain, Ernest photographiera le chantier, Martin déposera une facture… Il vous faut
quelques fichiers.* Préparez dans un dossier de l'ordinateur tout ce qui est listé à l'annexe D : quelques PDF (n'importe
lesquels feront l'affaire, on leur donnera des noms comme « Plan RDC » ou « Facture fournisseur »), et une demi-douzaine
de photos prises avec le téléphone, localisation activée.

Prévoyez aussi une **imprimante**, ou à défaut l'écran d'un second appareil : plusieurs QR codes devront être scannés
(le badge d'un ouvrier, l'entrée du chantier, le bon de commande du ciment).

- [ ] Mes fichiers de test sont prêts et je peux imprimer ou afficher des QR codes.

## Chapitre 2 — Le Gardien fait le tour de la maison

*Le matin du premier jour, avant que quiconque n'arrive, vous faites le tour du propriétaire. Les lumières s'allument,
les portes s'ouvrent. Mais est-ce que tout est bien branché ?*

### Scène P1 — Les voyants du tableau électrique

*Dans la plateforme, chaque service extérieur (l'envoi des e-mails, les notifications, la lecture des maquettes 3D,
l'antivirus…) est représenté par une carte, comme les disjoncteurs d'un tableau électrique. Une coche verte : le
courant passe. Une croix : il manque quelque chose.*

> **Qui :** vous, le Gardien (profil **GLOBUS ADM**). **Où :** l'ERP, sur l'ordinateur.

**Ce que vous faites**

1. Dans votre profil GLOBUS ADM, allez sur `https://globus-engineering-sarl.com/connexion` et connectez-vous comme
   d'habitude (e-mail, mot de passe, puis le code à 6 chiffres de votre téléphone).
2. Dans le menu de gauche, sous le titre **Administration**, cliquez sur **Paramètres**.
3. En haut de la page, cliquez sur l'onglet **Intégrations**.
4. Regardez la rangée de cartes en haut.

**Ce que vous devez constater**

- Une **coche verte** sur : E-mail, Notifications push web, Notifications push mobile, Autodesk APS, Antivirus,
  Reconnaissance vocale.
- Des **croix** sur les paiements en ligne, WhatsApp, SMS, et sur l'IA si sa clé n'a pas été renouvelée. Ces croix sont
  attendues : elles correspondent aux limites connues décrites à l'annexe A. Notez-les simplement.

- [ ] **P1** — Les voyants correspondent à ce qui est attendu.

### Scène P2 — Le cœur de la maison

*Derrière les murs bat un moteur : des tâches automatiques tournent la nuit, des sauvegardes se font chaque jour. On
vérifie qu'il ronronne.*

> **Qui :** le Gardien. **Où :** ERP, *Administration › Paramètres*.

**Ce que vous faites**

1. Toujours dans **Paramètres**, cliquez sur le bouton **Système et sauvegardes**.
2. Lisez les indicateurs en haut de la page, puis la liste des tâches planifiées.

**Ce que vous devez constater**

- « Événements en échec » vaut **0**.
- « Dernière sauvegarde » date de **moins de 24 heures**.
- Les tâches planifiées affichent un statut correct (pas d'erreur rouge).

- [ ] **P2** — Le système est en bonne santé.

### 2.3 La photographie de départ

*Si vous avez choisi le second chemin (tout effacer à la fin), ces deux scènes sont indispensables. Sinon, elles restent
une excellente précaution.*

### Scène P3 — Prendre la photo

> **Qui :** le Gardien. **Où :** ERP, *Paramètres › Système et sauvegardes*, section **Sauvegardes**.

**Ce que vous faites**

1. Dans la section **Sauvegardes**, choisissez le type **Complète**.
2. Cliquez sur **Sauvegarder maintenant**. La sauvegarde se fait en arrière-plan : patientez quelques minutes, puis
   actualisez la page jusqu'à ce qu'elle apparaisse terminée dans la liste.
3. Sur cette nouvelle sauvegarde, cliquez sur **Vérifier**.

**Ce que vous devez constater** : la vérification confirme l'intégrité de la sauvegarde (son empreinte et sa signature
sont correctes).

- [ ] **P3** — La sauvegarde complète est faite et vérifiée.

### Scène P4 — S'assurer que la photo est nette

*Une sauvegarde qu'on n'a jamais essayé de restaurer, c'est un parachute qu'on n'a jamais déplié. On l'essaie, sans
risque : la restauration de test se fait dans une base à part, la vraie plateforme n'est pas touchée.*

> **Qui :** le Gardien. **Où :** même écran.

**Ce que vous faites**

1. Sur la sauvegarde de la scène P3, cliquez sur **Test de restauration**.
2. Attendez la fin de l'opération.

**Ce que vous devez constater** : le test de restauration est réussi. **Notez la date et l'heure de cette sauvegarde**
sur votre feuille : c'est votre point de retour.

- [ ] **P4** — Le test de restauration a réussi ; la date de la sauvegarde est notée.

---

# Livre II — Les fondations

*Une maison commence par ses fondations, une entreprise par ses équipes. Avant qu'un seul client ne frappe à la porte,
il faut que chacun ait sa clé, que les partenaires soient enregistrés et que les équipes soient formées.*

## Chapitre 3 — Le Gardien distribue les clés

### Scène A1 — Le Gardien franchit la porte

*Vous voilà dans le hall de l'ERP. C'est ici que tout se décide. Prenez le temps de regarder autour de vous.*

> **Qui :** le Gardien (profil **GLOBUS ADM**). **Où :** `https://globus-engineering-sarl.com/connexion`, sur l'ordinateur.

**Ce que vous faites**

1. Si vous étiez déconnecté, saisissez votre adresse e-mail et votre mot de passe, puis cliquez sur **Se connecter**.
2. Ouvrez votre application d'authentification sur le téléphone, lisez le code à 6 chiffres affiché pour GLOBUS, tapez-le
   dans la case prévue et cliquez sur **Vérifier**.
3. Faites défiler le menu de gauche de haut en bas.

**Ce que vous devez constater**

- Vous arrivez sur le **Tableau de bord**.
- Le menu de gauche montre toutes les grandes rubriques : Projets, Achats et logistique, Sous-traitance, Finance,
  Commercial, RH et QHSE, Site web, Communication, Administration et Aide. Le Gardien voit tout : c'est normal, il a les
  clés de toutes les pièces.

- [ ] **A1** — Connexion réussie, toutes les rubriques sont visibles.

### Scène A2 — Le trousseau des rôles

*Chaque employé reçoit un trousseau : un « rôle ». Le rôle « Chef de chantier » ouvre certaines portes, pas d'autres.
Avant de distribuer les trousseaux, jetez un œil à l'un d'eux. Regardez, mais ne touchez à rien.*

> **Qui :** le Gardien. **Où :** ERP, *Administration › Utilisateurs et rôles*.

**Ce que vous faites**

1. Dans le menu de gauche, sous **Administration**, cliquez sur **Utilisateurs et rôles**.
2. Cliquez sur l'onglet **Rôles et permissions**.
3. Sur la ligne « Chef de chantier », cliquez sur **Voir**.

**Ce que vous devez constater** : une grande grille (la « matrice ») s'affiche, avec toutes les permissions du rôle,
cochées ou non. Les permissions dites **sensibles** (finances, données personnelles, sécurité) sont signalées. Refermez
sans rien modifier.

- [ ] **A2** — La matrice du rôle s'affiche correctement.

### Scène A3 — La quincaillerie entre dans le registre

*Quelque part à Bonabéri, sur la rive du Wouri, Martin Kamga tient une quincaillerie. Avant de pouvoir lui commander quoi
que ce soit, l'entreprise doit l'inscrire dans son registre, comme on inscrit un nouveau voisin dans le carnet
d'adresses.*

> **Qui :** le Gardien. **Où :** ERP, *Administration › Utilisateurs et rôles*, onglet **Organisations**.

**Ce que vous faites**

1. Toujours dans **Utilisateurs et rôles**, cliquez sur l'onglet **Organisations**.
2. Cliquez sur le bouton **Nouvelle organisation** en haut à droite.
3. Dans le champ **Nom**, écrivez `TEST Quincaillerie du Wouri`.
4. Dans la liste **Type**, choisissez **fournisseur**.
5. Dans **Ville**, écrivez `Douala`.
6. Cliquez sur le bouton d'enregistrement en bas de la fenêtre.

**Ce que vous devez constater** : la fenêtre se ferme et « TEST Quincaillerie du Wouri » apparaît dans la liste. Si vous
filtrez la liste avec **Type = fournisseur**, elle est toujours là.

- [ ] **A3** — L'organisation fournisseur est créée.

### Scène A4 — Les électriciens d'Akwa

*À l'autre bout de la ville, dans le quartier d'Akwa, Sylvie Abena dirige une petite entreprise d'électricité. Elle aussi
entre dans le registre.*

> **Qui :** le Gardien. **Où :** même onglet **Organisations**.

**Ce que vous faites**

1. Cliquez de nouveau sur **Nouvelle organisation**.
2. **Nom** : `TEST Électricité Akwa`. **Type** : **sous-traitant**.
3. Enregistrez.

**Ce que vous devez constater** : « TEST Électricité Akwa » apparaît dans la liste.

- [ ] **A4** — L'organisation sous-traitant est créée.

### Scène A5 — La fiche de Martin dans le carnet des fournisseurs

*Le registre des organisations dit « qui existe ». Le carnet des fournisseurs, lui, dit « à qui l'on achète, quoi, à quel
prix et dans quels délais ». Il faut relier les deux : c'est ce lien qui permettra à Martin, plus tard, d'ouvrir sa propre
porte dans l'extranet.*

> **Qui :** le Gardien. **Où :** ERP, *Achats et logistique › Fournisseurs*.

**Ce que vous faites**

1. Dans le menu de gauche, sous **Achats et logistique**, cliquez sur **Fournisseurs**.
2. Cliquez sur **Nouveau fournisseur**.
3. **Raison sociale** : `TEST Quincaillerie du Wouri`.
4. **Catégories** : ajoutez « ciment » et « acier ».
5. **E-mail** : `votre.adresse+fournisseur@gmail.com`.
6. **Délai de livraison** : `3` (jours).
7. Dans le champ **Organisation**, choisissez « TEST Quincaillerie du Wouri » dans la liste. *C'est le lien essentiel.*
8. Enregistrez.

**Ce que vous devez constater** : la fiche du fournisseur s'ouvre, avec ses onglets **Profil**, **Catalogue et tarifs**,
**Commandes**, **Documents**, **Performance**, **Incidents** et **Contacts**.

- [ ] **A5** — La fiche fournisseur est créée et reliée à son organisation.

### Scène A6 — Le sac de ciment entre au catalogue

*Martin vend un ciment bien connu des maçons de Douala : le CPJ 42.5, en sacs de cinquante kilos. Inscrivons-le à son
catalogue, avec son prix.*

> **Qui :** le Gardien. **Où :** fiche du fournisseur, onglet **Catalogue et tarifs**.

**Ce que vous faites**

1. Sur la fiche « TEST Quincaillerie du Wouri », cliquez sur l'onglet **Catalogue et tarifs**.
2. Cliquez sur **Nouveau produit**.
3. **Référence** : `CIM-425`. **Nom** : `Ciment CPJ 42.5 sac 50 kg`. **Unité** : sac.
4. **Prix unitaire** : `5200` (francs CFA).
5. **Prix valable jusqu'au** : une date dans trois mois.
6. Enregistrez.

**Ce que vous devez constater** : le ciment apparaît dans le catalogue de Martin.

- [ ] **A6** — Le produit est au catalogue.

### Scène A7 — La fiche de Sylvie dans le carnet des sous-traitants

*Même travail pour Sylvie, dans le carnet des sous-traitants. Son entreprise n'est pas encore « qualifiée » : on ne
confie pas l'électricité d'une maison à une entreprise sans avoir vérifié ses références. Ce sera fait au chapitre 9.*

> **Qui :** le Gardien. **Où :** ERP, *Sous-traitance › Sous-traitants*.

**Ce que vous faites**

1. Dans le menu de gauche, sous **Sous-traitance**, cliquez sur **Sous-traitants**.
2. Cliquez sur **Nouveau sous-traitant**.
3. **Raison sociale** : `TEST Électricité Akwa`.
4. **Corps de métier** : dans la famille « lots techniques », cochez **électricité**.
5. **Assurance RC** : indiquez une date d'échéance dans le futur (par exemple dans un an).
6. **E-mail** : `votre.adresse+soustraitant@gmail.com`.
7. **Organisation** : choisissez « TEST Électricité Akwa ».
8. Enregistrez.

**Ce que vous devez constater** : la fiche est créée avec le statut **en qualification**.

- [ ] **A7** — La fiche sous-traitant est créée.

### Scène A8 — Une équipe sans chef

*Sur un chantier, on ne travaille pas seul. L'équipe de gros œuvre existe déjà dans l'esprit de l'entreprise ; donnons-lui
une existence dans la plateforme. Son chef sera désigné un peu plus tard, quand Ernest aura sa clé.*

> **Qui :** le Gardien. **Où :** ERP, *Administration › Utilisateurs et rôles*, onglet **Équipes**.

**Ce que vous faites**

1. Dans **Utilisateurs et rôles**, cliquez sur l'onglet **Équipes**, puis sur **Nouvelle équipe**.
2. **Nom** : `TEST Équipe gros œuvre`. **Métier** : maçonnerie.
3. Enregistrez (laissez le chef d'équipe vide pour l'instant).

**Ce que vous devez constater** : l'équipe apparaît dans la liste.

- [ ] **A8** — L'équipe est créée.

### Scène A9 — Sept invitations pour sept collègues

*Le moment est venu d'appeler l'équipe. Grâce, Jordan, Samuel, Ernest, Linda, Rachel et Moussa vont chacun recevoir une
invitation par e-mail, avec un lien personnel pour choisir leur mot de passe. Aucun mot de passe ne circule : c'est
chaque personne qui choisit le sien.*

> **Qui :** le Gardien. **Où :** ERP, *Administration › Utilisateurs et rôles*, onglet **Utilisateurs**.

**Ce que vous faites** — recommencez ces gestes **sept fois**, une fois par collègue :

1. Dans **Utilisateurs et rôles**, onglet **Utilisateurs**, cliquez sur **Nouvel utilisateur**.
2. **E-mail** : l'adresse du personnage (voir le tableau des personnages).
3. **Prénom** : le prénom du personnage (Grâce, Jordan, Samuel, Ernest, Linda, Rachel, Moussa).
4. **Nom** : écrivez le nom précédé de « TEST- », par exemple `TEST-EWANE`, `TEST-NKENG`, `TEST-FOTSO`, `TEST-TCHOUA`,
   `TEST-MBARGA`, `TEST-NDONGO`, `TEST-BELLO`. Ainsi, tous les comptes d'essai se reconnaissent d'un coup d'œil.
5. **Rôles** : cochez le ou les rôles indiqués dans le tableau. Pour Ernest, cochez les trois : *Chef de chantier*,
   *Magasinier* et *Responsable QHSE*. Pour Rachel, les deux : *Finance / Comptabilité* et *Ressources humaines*.
6. **Métier** : pour Ernest, choisissez « Chef de chantier » ; pour les autres, laissez « Non précisé » sauf si un métier
   s'impose (Moussa peut être électricien, par exemple).
7. Laissez cochée la case **Envoyer l'invitation** et choisissez le canal **E-mail**.
8. Enregistrez.

**Ce que vous devez constater**

- Les sept comptes apparaissent dans la liste avec le statut « invité ».
- L'onglet **Invitations** liste sept invitations « en attente ».
- Dans votre boîte Gmail arrivent sept e-mails d'invitation (un par adresse « + »). Ne les ouvrez pas encore.

- [ ] **A9** — Les sept collègues sont invités.

### Scène A10 — Les partenaires reçoivent leur clé

*Martin et Sylvie ne sont pas des employés. Ils n'entreront donc pas par la porte du personnel, mais par celle des
partenaires, l'extranet. C'est leur organisation qui décide de la porte.*

> **Qui :** le Gardien. **Où :** même onglet **Utilisateurs**.

**Ce que vous faites**

1. **Nouvel utilisateur** pour Martin : adresse `+fournisseur`, prénom `Martin`, nom `TEST-KAMGA`, rôle **Fournisseur**,
   organisation « TEST Quincaillerie du Wouri », invitation par e-mail. Enregistrez.
2. **Nouvel utilisateur** pour Sylvie : adresse `+soustraitant`, prénom `Sylvie`, nom `TEST-ABENA`, rôle **Sous-traitant**,
   organisation « TEST Électricité Akwa », invitation par e-mail. Enregistrez.

**Ce que vous devez constater** : deux invitations supplémentaires « en attente » (neuf en tout).

- [ ] **A10** — Les deux partenaires sont invités.

### Scène A11 — L'invitation envoyée par erreur

*Il arrive à tout le monde de se tromper d'adresse. Que se passe-t-il alors ? On peut rattraper l'invitation avant qu'elle
ne serve.*

> **Qui :** le Gardien. **Où :** onglets **Utilisateurs** puis **Invitations**.

**Ce que vous faites**

1. Créez un **Nouvel utilisateur** avec l'adresse `votre.adresse+erreur@gmail.com` (prénom et nom au choix, un rôle
   quelconque, invitation par e-mail).
2. Ouvrez l'onglet **Invitations**, repérez cette invitation et cliquez sur **Révoquer**.
3. Dans Gmail, ouvrez l'e-mail reçu sur l'adresse `+erreur` et cliquez sur son lien.

**Ce que vous devez constater** : l'invitation passe au statut « révoquée », et le lien de l'e-mail ne fonctionne plus (un
message indique que le lien est invalide ou expiré).

*Mais imaginons que l'adresse était la bonne, et que la révocation était elle-même une erreur. Le Gardien peut envoyer un
nouveau lien.*

4. Toujours dans l'onglet **Invitations**, sur la ligne révoquée, cliquez sur **Renvoyer**.
5. Dans la fenêtre **Renvoyer l'invitation**, laissez **E-mail** coché, écrivez un petit message si vous le souhaitez, puis
   cliquez sur **Renvoyer**.
6. Ouvrez le nouvel e-mail reçu sur l'adresse `+erreur` et cliquez sur son lien ; vérifiez que la page d'activation
   s'affiche, puis fermez-la sans activer le compte.
7. Dans l'onglet **Utilisateurs**, ouvrez ce compte : son statut est **Invité**. Cliquez sur **Désactiver** pour qu'il ne
   serve plus.

**Ce que vous devez aussi constater** : le nouveau lien fonctionne, l'ancien non ; la liste des invitations montre la
nouvelle invitation « en attente » et l'ancienne « révoquée » (sans bouton **Renvoyer**, seule la plus récente l'a).

- [ ] **A11** — Une invitation révoquée devient inutilisable, et un nouveau lien peut être renvoyé.

### Scène A12 — Chacun ouvre sa porte

*Le jour se lève sur la plateforme. L'un après l'autre, vos collègues ouvrent leur e-mail d'invitation, choisissent leur
mot de passe et posent leur seconde serrure. C'est vous qui allez jouer chacun d'eux. Prenez votre temps : cette scène se
répète neuf fois.*

> **Qui :** tour à tour Grâce, Jordan, Samuel, Ernest, Linda, Rachel, Moussa, Martin et Sylvie, **chacun dans son propre
> profil de navigateur**. **Où :** Gmail, puis la plateforme.

**Ce que vous faites** — pour chaque personnage :

1. Ouvrez la fenêtre Chrome du profil du personnage (par exemple **GLOBUS DIR** pour Grâce).
2. Dans cette fenêtre, ouvrez Gmail, retrouvez l'e-mail d'invitation adressé à l'adresse « + » du personnage (regardez
   aussi dans les Spams) et cliquez sur le lien.
3. Sur la page d'activation, vérifiez que le prénom et le nom sont justes.
4. Choisissez un mot de passe d'au moins **12 caractères** (notez-le sur votre feuille, personnage par personnage), puis
   cliquez sur **Activer et continuer**.
5. **Pour Grâce et Rachel, c'est obligatoire ; pour les autres, c'est vivement conseillé** : posez la seconde serrure.
   - Ouvrez **Mon compte** (en cliquant sur votre nom en haut à droite, ou dans le menu), puis l'onglet **Sécurité**.
   - Cliquez sur **Configurer une application d'authentification**. Un QR code apparaît.
   - Sur le téléphone, dans l'application d'authentification, touchez le **+**, puis **Scanner un code QR**, et visez le
     QR code à l'écran. Une nouvelle ligne apparaît dans l'application.
   - Tapez le code à 6 chiffres affiché par l'application et cliquez sur **Activer**.
   - Cliquez sur **Télécharger** pour enregistrer les codes de secours, rangez le fichier en lieu sûr, puis cliquez sur
     **J'ai conservé mes codes**.
6. Astuce : dans l'application d'authentification, renommez chaque ligne avec le nom du personnage, pour ne pas les
   confondre.

**Ce que vous devez constater**

- Chaque employé arrive dans l'ERP, sur `/erp`, avec un **menu réduit à son métier** (Ernest ne voit pas la Finance,
  Rachel ne voit pas le Hub BIM, etc.).
- Martin et Sylvie arrivent dans l'**extranet**, sur `/extranet`.
- Chez Grâce et Rachel, le bandeau rouge « La double authentification est obligatoire pour votre profil » disparaît dès
  que la seconde serrure est activée.
- Côté Gardien, dans *Administration › Sécurité*, onglet **Synthèse**, la rubrique « MFA à activer » ne cite plus Grâce ni
  Rachel.

- [ ] **A12** — Les neuf comptes sont activés, la double authentification est en place au moins pour Grâce et Rachel.

### Scène A13 — L'équipe trouve son chef

*Ernest a maintenant sa clé. Il peut prendre la tête de l'équipe de gros œuvre, avec Moussa à ses côtés.*

> **Qui :** le Gardien. **Où :** *Utilisateurs et rôles*, onglet **Équipes**.

**Ce que vous faites**

1. Ouvrez l'équipe « TEST Équipe gros œuvre » et cliquez sur **Modifier**.
2. **Chef d'équipe** : Ernest. **Membres** : Ernest et Moussa.
3. Enregistrez.

**Ce que vous devez constater** : la fiche de l'équipe affiche le chef et les membres **par leur nom** (et non par un code
incompréhensible).

- [ ] **A13** — L'équipe est complète.

---

# Livre III — La rencontre

*Toute histoire de maison commence par un rêve et une rencontre. Paul ne connaît pas encore GLOBUS. Il cherche, il
compare, il hésite. Ce livre raconte comment un simple visiteur devient un client.*

## Chapitre 4 — Un visiteur pousse la porte

*C'est un dimanche soir. Paul Mballa, après des années d'économies, a enfin un terrain à Bonamoussadi. Allongé sur son
canapé, téléphone en main, il tape « construction villa Douala » dans son moteur de recherche. Un lien l'amène sur le
site de GLOBUS ENGINEERING.*

Pour ce chapitre, vous êtes un visiteur anonyme : vous n'êtes connecté à rien. Utilisez le profil **Visiteur** de Chrome
sur l'ordinateur, **et refaites aussi le parcours sur un téléphone**, car la plupart des vrais visiteurs viendront de leur
téléphone.

### Scène V1 — La question des cookies

*À peine arrivé, Paul voit apparaître en bas de l'écran un bandeau qui lui parle de « cookies ». Ce sont de petits
fichiers qui permettent, entre autres, de mesurer l'audience du site. La loi impose de lui demander son accord.*

> **Qui :** le Visiteur. **Où :** la page d'accueil du site, `https://globus-engineering-sarl.com`.

**Ce que vous faites**

1. Ouvrez la page d'accueil dans le profil Visiteur.
2. Sur le bandeau des cookies, cliquez sur **Personnaliser**.
3. Refusez la mesure d'audience, puis enregistrez votre choix.
4. Actualisez la page (touche **F5**).
5. Descendez tout en bas de la page, dans le pied de page, et cliquez sur **Gérer les cookies**.

**Ce que vous devez constater** : après l'actualisation, le bandeau ne revient pas ; le lien **Gérer les cookies** le fait
réapparaître pour changer d'avis.

- [ ] **V1** — Le choix des cookies est respecté et modifiable.

### Scène V2 — La promenade dans les pièces de la vitrine

*Paul flâne. Il ouvre un menu, puis un autre, regarde les réalisations, revient en arrière. Un seul lien cassé, une seule
image absente, et la confiance s'effrite.*

> **Qui :** le Visiteur. **Où :** tout le site, sur ordinateur **et** sur téléphone.

**Ce que vous faites**

1. Cliquez une à une sur toutes les entrées du menu du haut, et sur chaque entrée des sous-menus qui se déroulent.
2. Sur téléphone, ouvrez le menu **☰** en haut et parcourez-le.
3. Cliquez sur les boutons d'action de l'en-tête (par exemple **Décrire mon projet** ou **Contact**), sans remplir les
   formulaires pour l'instant.
4. En bas de page, cliquez sur chaque lien du pied de page : colonne principale, colonne des services, liens légaux.

**Ce que vous devez constater**

- Aucune page « introuvable », aucune image cassée (un petit carré vide à la place d'une photo).
- Tous les textes sont en français.
- Sur téléphone, rien ne déborde de l'écran, rien n'est illisible.

- [ ] **V2** — La navigation est impeccable sur ordinateur et sur téléphone.

### Scène V3 — Paul cherche

*Paul se demande si GLOBUS construit des villas. Il clique sur la petite loupe.*

> **Qui :** le Visiteur. **Où :** icône **loupe** en haut du site.

**Ce que vous faites**

1. Cliquez sur la loupe, tapez `villa`, validez.
2. Recommencez avec le mot `devis`.

**Ce que vous devez constater** : des résultats pertinents s'affichent (pages, offres, articles, questions fréquentes), et
le mot recherché y est surligné.

- [ ] **V3** — La recherche du site fonctionne.

### Scène V4 — Les vitrines dans la vitrine

*Paul lit une offre, s'attarde sur une réalisation, parcourt un article du blog, consulte la foire aux questions.*

> **Qui :** le Visiteur. **Où :** les rubriques du site.

**Ce que vous faites**

1. Ouvrez une offre, une expertise, un service, une réalisation, un article de blog, la page FAQ et le centre d'aide.

**Ce que vous devez constater** : chaque page s'affiche avec ses images et son texte, et les contenus « mis en avant »
apparaissent bien sur la page d'accueil.

- [ ] **V4** — Les contenus s'affichent correctement.

### Scène V5 — « Décrire mon projet »

*Paul se décide. Il clique sur le grand bouton **Décrire mon projet**. En quatre petites étapes, il raconte son rêve. Sans
le savoir, il vient de devenir ce que les commerciaux appellent un « lead » : un prospect.*

> **Qui :** le Visiteur, qui devient Paul. **Où :** bouton **Décrire mon projet**.

**Ce que vous faites**

1. Cliquez sur **Décrire mon projet**.
2. **Étape « Votre univers »** : choisissez **HOME** (la maison individuelle), puis cliquez sur **Continuer**.
3. **Étape « Votre projet »** : type maison, surface `180` m², `2` niveaux, terrain : **Oui**, ville `Douala`. Cliquez
   sur **Continuer**.
4. **Étape « Budget et délai »** : budget de `20 000 000` à `30 000 000` XAF, délai **3 mois**, financement **Fonds
   propres**. Cliquez sur **Continuer**.
5. **Étape « Vos coordonnées »** : prénom `Paul`, nom `TEST-MBALLA`, e-mail `votre.adresse+client@gmail.com`, un numéro de
   téléphone, contact préféré **email**, et cochez la case de consentement.
6. Cliquez sur **Envoyer ma demande**.

**Ce que vous devez constater**

- Un message de confirmation s'affiche, avec un numéro de demande.
- Quelques instants plus tard, un e-mail d'accusé de réception arrive sur l'adresse `+client`.

- [ ] **V5** — La demande de Paul est envoyée et accusée.

### Scène V6 — La photo du terrain

*Encore curieux, Paul découvre la page « Estimation instantanée ». Il y dépose la photo de son terrain, pour avoir une
première idée du prix.*

> **Qui :** Paul (encore anonyme). **Où :** la page **Estimation instantanée** du site.

**Ce que vous faites**

1. Ouvrez la page d'estimation instantanée.
2. Déposez une photo de terrain (ou un croquis), décrivez le projet en quelques lignes.
3. Indiquez les coordonnées de Paul (adresse `+client`), cochez le consentement et envoyez.

**Ce que vous devez constater** : la demande est enregistrée. L'analyse automatique de la photo dépend de l'intelligence
artificielle, qui peut être indisponible (voir annexe A) ; ce n'est pas une anomalie.

- [ ] **V6** — La demande d'estimation est enregistrée.

### Scène V7 — Un autre visiteur écrit

*Pendant ce temps, une autre personne, curieuse, remplit le formulaire de contact.*

> **Qui :** un autre visiteur. **Où :** la page **Contact**.

**Ce que vous faites**

1. Remplissez le formulaire avec l'adresse `votre.adresse+contact@gmail.com` et un petit message.
2. Envoyez.

**Ce que vous devez constater** : un message de succès s'affiche, et un e-mail d'accusé de réception arrive sur l'adresse
`+contact`.

- [ ] **V7** — Le formulaire de contact fonctionne.

### Scène V8 — L'abonnement à la lettre d'information

*Une lectrice fidèle s'abonne à la lettre d'information. La plateforme, prudente, lui demande de confirmer par e-mail :
c'est ce qu'on appelle le « double consentement ».*

> **Qui :** un visiteur. **Où :** le pied de page, bloc **Newsletter**.

**Ce que vous faites**

1. Dans le pied de page, saisissez `votre.adresse+news@gmail.com`, cochez la case d'accord et cliquez sur **S'inscrire**.
2. Ouvrez l'e-mail de confirmation reçu sur l'adresse `+news` et cliquez sur le lien qu'il contient.

**Ce que vous devez constater** : l'inscription est confirmée. (Vous verrez cette abonnée avec le statut « confirmé » au
chapitre 16.)

- [ ] **V8** — L'abonnement est confirmé par e-mail.

### Scène V9 — La conversation avec l'assistant

*Paul, insomniaque, pose une question à la petite bulle de discussion qui clignote en bas de l'écran.*

> **Qui :** le Visiteur. **Où :** la bulle en bas à droite du site.

**Ce que vous faites**

1. Cliquez sur la bulle de l'assistant.
2. Écrivez : `Combien coûte une villa de 150 m² ?`
3. Si l'assistant propose de laisser vos coordonnées, faites-le.

**Ce que vous devez constater** : l'assistant répond de façon cohérente (s'il fonctionne sans l'intelligence artificielle,
il répond à partir de règles préparées à l'avance). Cette conversation sera retrouvée par Jordan au chapitre suivant.

- [ ] **V9** — L'assistant répond.

### Scène V10 — Un commentaire sous un article

*Avant de fermer son téléphone, Paul laisse un mot sous un article du blog.*

> **Qui :** le Visiteur. **Où :** un article du blog.

**Ce que vous faites**

1. Ouvrez un article du blog, descendez jusqu'au formulaire de commentaire.
2. Indiquez un nom, un e-mail et un commentaire, puis envoyez.

**Ce que vous devez constater** : le message « Votre commentaire sera publié après modération » s'affiche. (Il sera modéré
au chapitre 16.)

- [ ] **V10** — Le commentaire est en attente de modération.

### Scène V11 — Les petits caractères

*Un visiteur prudent lit toujours les mentions légales. Un client exigeant aussi.*

> **Qui :** le Visiteur. **Où :** les liens légaux du pied de page.

**Ce que vous faites** : ouvrez les mentions légales, la politique de confidentialité, la politique cookies et les
conditions générales d'utilisation.

**Ce que vous devez constater** : chaque page a un vrai contenu, à jour, avec les bonnes coordonnées de l'entreprise.

- [ ] **V11** — Les pages légales sont complètes.

## Chapitre 5 — Jordan, le commercial, entre en scène

*Lundi matin, huit heures. Jordan Nkeng pose son café sur son bureau et ouvre l'ERP. Une notification l'attend : un
certain Paul, à Douala, rêve d'une villa. Commence alors un patient travail de commercial, du premier appel jusqu'à la
signature.*

### Scène C1 — La règle qui distribue les prospects

*Avant que Jordan ne s'installe, le Gardien règle une petite mécanique : tous les prospects de Douala iront
automatiquement à Jordan. Ainsi, aucune demande ne reste sans réponse.*

> **Qui :** le Gardien (profil GLOBUS ADM). **Où :** ERP, *Commercial › CRM*, onglet **Réglages**.

**Ce que vous faites**

1. Dans le menu de gauche, sous **Commercial**, cliquez sur **CRM**, puis sur l'onglet **Réglages**.
2. Dans la partie **Règles d'affectation des leads**, cliquez sur **Nouvelle règle**.
3. **Nom** : `TEST Douala`. **Critère** : ville `Douala`. **Commerciaux** : Jordan. **Stratégie** : tour de rôle.
4. Enregistrez.

**Ce que vous devez constater** : la règle est active ; les prochains prospects de Douala iront à Jordan.

> Si la demande de Paul (scène V5) est arrivée avant cette règle, elle n'a peut-être pas été affectée à Jordan : à la scène
> C2, vous pourrez l'affecter à la main avec le bouton **Affecter** de la fiche.

- [ ] **C1** — La règle d'affectation est en place.

### Scène C2 — Le prospect est arrivé

> **Qui :** Jordan (profil **GLOBUS COM**). **Où :** ERP, *Commercial › CRM*, onglet **Leads**.

**Ce que vous faites**

1. Dans la fenêtre de Jordan, ouvrez l'ERP, puis *Commercial › CRM*, onglet **Leads**.
2. Regardez la cloche en haut à droite.

**Ce que vous devez constater**

- Les demandes de Paul (scènes V5 et V6, et V7 si le formulaire de contact crée aussi un prospect) apparaissent dans la
  liste, avec leur source, leur univers, leur score, leur « température » (froid, tiède, chaud) et un chronomètre : le
  délai de première réponse.
- La cloche de Jordan signale une nouvelle notification.

- [ ] **C2** — Les prospects sont arrivés chez Jordan.

### Scène C3 — Le dossier de Paul

*Jordan ouvre la fiche de Paul et découvre tout ce qu'il a raconté dimanche soir.*

> **Qui :** Jordan. **Où :** la fiche du lead de la scène V5.

**Ce que vous faites** : cliquez sur la ligne du prospect Paul.

**Ce que vous devez constater** : le bloc **Dossier « Décrire mon projet »** reprend toutes les réponses de Paul, avec un
taux de complétude, et le score est expliqué.

- [ ] **C3** — Le dossier du prospect est complet.

### Scène C4 — Le premier appel

*Jordan décroche son téléphone. Paul répond, surpris et ravi d'être rappelé si vite. Ils conviennent d'une visite du
terrain. Jordan note l'appel : le chronomètre s'arrête.*

> **Qui :** Jordan. **Où :** fiche du lead.

**Ce que vous faites**

1. Sur la fiche de Paul, cliquez sur **Activité**.
2. **Type** : appel. **Compte rendu** : `Premier échange, RDV terrain`. **Relance** : dans deux jours.
3. Enregistrez.

**Ce que vous devez constater** : le chronomètre du délai de réponse s'arrête, et le statut du prospect passe à
« contacté ».

- [ ] **C4** — La première activité est enregistrée.

### Scène C5 — Qualifier le projet

*Paul a un vrai budget, un délai réaliste, et c'est lui qui décide. Jordan le note : le prospect est « qualifié ».*

> **Qui :** Jordan. **Où :** fiche du lead.

**Ce que vous faites**

1. Cliquez sur **Qualifier**.
2. Renseignez le besoin, le budget `25 000 000`, le délai de 3 mois, et indiquez que Paul est bien le décisionnaire.
3. Enregistrez.

**Ce que vous devez constater** : le statut devient « qualifié ».

- [ ] **C5** — Le prospect est qualifié.

### Scène C6 — Du prospect à l'affaire

*Le rêve de Paul devient une « opportunité » : une affaire que l'entreprise espère gagner.*

> **Qui :** Jordan. **Où :** fiche du lead.

**Ce que vous faites**

1. Cliquez sur **Convertir en opportunité**.
2. **Montant estimé** : `25 000 000` XAF. Choisissez une **étape** et une **date de décision** dans quinze jours.
3. Validez, puis cliquez sur **Voir le pipeline**.

**Ce que vous devez constater**

- Une carte au nom de Paul apparaît dans l'onglet **Pipeline**.
- Dans l'onglet **Contacts**, un contact « Paul TEST-MBALLA » a été créé, ainsi qu'une organisation cliente.

- [ ] **C6** — L'opportunité est créée.

### Scène C7 — L'affaire avance d'une case

*Le pipeline ressemble à un tableau de liège avec des colonnes. Chaque affaire est une carte que l'on fait glisser de
colonne en colonne à mesure qu'elle avance.*

> **Qui :** Jordan. **Où :** onglet **Pipeline**.

**Ce que vous faites** : cliquez sur la carte de Paul, gardez le bouton de la souris enfoncé, faites-la glisser jusqu'à
la colonne suivante, puis relâchez. Actualisez ensuite la page.

**Ce que vous devez constater** : la carte a changé de colonne et y reste après l'actualisation.

- [ ] **C7** — Le pipeline se met à jour.

### Scène C8 — Le devis

*Après la visite du terrain, Jordan prépare le devis : les études, le gros œuvre, le second œuvre. Trois lignes, une TVA,
et un échéancier en trois temps.*

> **Qui :** Jordan. **Où :** la carte de Paul dans le pipeline.

**Ce que vous faites**

1. Sur la carte de l'opportunité, cliquez sur **Devis**.
2. Ajoutez trois lignes (bouton **Ligne**) :
   - « Études et plans » : quantité `1`, prix unitaire `3 000 000` ;
   - « Gros œuvre » : quantité `1`, prix unitaire `15 000 000` ;
   - « Second œuvre » : quantité `1`, prix unitaire `7 000 000`.
3. Vérifiez la **TVA** : 19,25 %.
4. Dans l'échéancier (bouton **Échéance**), créez trois échéances : 30 % à la signature, 40 % à mi-chantier, 30 % à la
   réception.
5. **Validité** : 30 jours. Enregistrez.
6. Cliquez sur **PDF** pour voir le document.

**Ce que vous devez constater** : les totaux hors taxes, TVA et toutes taxes comprises sont justes (25 000 000 HT), et le
PDF est lisible, propre, aux couleurs de l'entreprise.

- [ ] **C8** — Le devis est juste et son PDF est présentable.

### Scène C9 — Le devis part chez Paul

> **Qui :** Jordan. **Où :** la fiche du devis.

**Ce que vous faites** : cliquez sur **Envoyer**.

**Ce que vous devez constater** : le devis passe au statut « envoyé », et un e-mail arrive sur l'adresse `+client`, avec
un lien sécurisé vers le devis.

- [ ] **C9** — Le devis est envoyé.

### Scène C10 — Paul signe du bout des doigts

*Le soir même, Paul ouvre l'e-mail. Il lit le devis ligne par ligne, sourit, et l'accepte. Pas besoin d'imprimer, de
signer, de scanner : un code reçu par e-mail fait office de signature, et la plateforme en garde la preuve.*

> **Qui :** Paul, qui n'a pas encore de compte (profil **GLOBUS CLI**). **Où :** le lien de l'e-mail.

**Ce que vous faites**

1. Dans la fenêtre GLOBUS CLI, ouvrez Gmail, puis l'e-mail du devis reçu sur `+client`, et cliquez sur le lien.
2. Lisez le devis. En bas, saisissez le **Nom et prénom du signataire**.
3. Cochez la case « J'ai lu le devis et j'accepte ses conditions. »
4. Cliquez sur **Recevoir mon code** (par e-mail). Un code arrive dans Gmail.
5. Tapez ce code dans le champ **Code reçu**, puis cliquez sur **Accepter ce devis**.

**Ce que vous devez constater**

- La page affiche « Devis accepté ».
- Chez Jordan, le devis passe « accepté », avec la preuve de l'acceptation (date, heure, moyen de réception du code), et
  Jordan reçoit une notification.

- [ ] **C10** — Le client a accepté le devis par code.

### Scène C11 — Le devis qu'on révise et celui qu'on perd

*Tous les devis ne se terminent pas aussi bien. On vérifie qu'on peut réviser un devis sans perdre l'ancienne version, et
enregistrer un refus.*

> **Qui :** Jordan. **Où :** onglet **Devis**.

**Ce que vous faites**

1. Créez un **second** devis, en brouillon, pour l'opportunité de Paul (une seule ligne suffit).
2. Cliquez sur **Réviser** : une nouvelle version est créée.
3. Puis, sur ce second devis, cliquez sur **Refus client** et indiquez le motif « prix ».

**Ce que vous devez constater** : la révision crée une nouvelle version, l'ancienne reste consultable, et le second devis
passe au statut « refusé ». Le premier devis, accepté, n'est pas touché.

- [ ] **C11** — La révision et le refus fonctionnent.

### Scène C12 — Le contrat

*Un devis accepté, c'est une promesse. Le contrat, c'est un engagement.*

> **Qui :** le Gardien (ou Jordan, qui a aussi le droit de gérer les contrats). **Où :** le devis accepté.

**Ce que vous faites**

1. Ouvrez le devis accepté (celui de la scène C10) et cliquez sur **Établir le contrat**.
2. Vérifiez les conditions et l'échéancier contractuel, repris du devis, puis validez.

**Ce que vous devez constater** : le contrat apparaît dans l'onglet **Contrats**, avec son **Échéancier contractuel**.

- [ ] **C12** — Le contrat est établi.

### Scène C13 — La signature

*Paul est venu au bureau, stylo en main. Le contrat papier est signé, scanné, et la signature est enregistrée dans la
plateforme.*

> **Qui :** le Gardien. **Où :** onglet **Contrats**.

**Ce que vous faites**

1. Ouvrez le contrat et cliquez sur **Contrat signé**.
2. **Date** : aujourd'hui. **Mode** : signature manuscrite scannée. Joignez un PDF (le « contrat signé » de l'annexe D).
3. Cliquez sur **Enregistrer la signature**.

**Ce que vous devez constater** : le contrat passe au statut « signé ».

- [ ] **C13** — La signature est enregistrée.

### Scène C14 — La naissance du projet (et du compte de Paul)

*C'est le moment le plus important du chapitre. En un seul clic, le contrat devient un projet de chantier : son budget,
ses jalons de paiement, son chef de projet. Et, dans le même mouvement, la plateforme envoie à Paul les clés de son
espace client.*

> **Qui :** le Gardien. **Où :** le contrat signé.

**Ce que vous faites**

1. Sur le contrat signé, cliquez sur **Créer le projet**.
2. **Nom** : `TEST — Villa Mballa`. **Responsable** : Samuel.
3. Validez, puis cliquez sur **Projet** pour ouvrir sa fiche.

**Ce que vous devez constater**

- Le projet est créé avec un code de la forme PRJ-AAAA-NNNNN.
- Il possède déjà un budget initial réparti par lot, des **jalons** issus de l'échéancier (30 %, 40 %, 30 %), et Samuel
  figure parmi ses membres.
- **Paul reçoit un e-mail d'invitation** à son espace client, sur l'adresse `+client`.

- [ ] **C14** — Le projet est né et Paul est invité.

### Scène C15 — La relance du mercredi

*Jordan n'oublie rien : la relance prévue lors du premier appel l'attend.*

> **Qui :** Jordan. **Où :** *CRM*, onglet **Activités**.

**Ce que vous faites** : retrouvez la relance créée à la scène C4 et cliquez sur **Marquer faite**.

**Ce que vous devez constater** : la relance est close.

- [ ] **C15** — Les relances se suivent et se ferment.

### Scène C16 — La conversation de la nuit

*Jordan retrouve la conversation que Paul avait eue avec l'assistant du site.*

> **Qui :** Jordan. **Où :** *Commercial › Assistant et WhatsApp*.

**Ce que vous faites** : ouvrez la conversation de la scène V9, lisez-la, puis cliquez sur **Clore**.

**Ce que vous devez constater** : la conversation est lisible en entier, puis close.

- [ ] **C16** — Les conversations de l'assistant sont consultables.

## Chapitre 6 — Paul reçoit ses clés

*Paul ouvre l'e-mail de GLOBUS avec une petite émotion : « Votre espace client est prêt ». Derrière ce lien se trouve sa
maison avant la maison, le lieu où il la verra naître.*

### Scène K1 — L'activation

> **Qui :** Paul (profil **GLOBUS CLI**). **Où :** l'e-mail d'invitation reçu sur `+client`.

**Ce que vous faites**

1. Dans la fenêtre GLOBUS CLI, ouvrez l'e-mail d'invitation et cliquez sur son lien.
2. Vérifiez le prénom et le nom, choisissez un mot de passe d'au moins 12 caractères (notez-le), puis cliquez sur
   **Activer et continuer**.

**Ce que vous devez constater** : Paul arrive dans son espace client, et la plateforme lui demande aussitôt de poser sa
seconde serrure.

- [ ] **K1** — Le compte de Paul est activé.

### Scène K2 — La seconde serrure de Paul

*Pour un client, la double authentification n'est pas une option : son espace permet de valider des décisions et de
payer. La plateforme refuse d'aller plus loin tant qu'elle n'est pas posée.*

> **Qui :** Paul. **Où :** *Mon compte*, onglet **Sécurité**.

**Ce que vous faites**

1. Cliquez sur **Configurer une application d'authentification**.
2. Scannez le QR code avec l'application d'authentification du téléphone, tapez le code affiché, puis cliquez sur
   **Activer**.
3. Téléchargez les codes de secours, puis cliquez sur **J'ai conservé mes codes**.

**Ce que vous devez constater** : le reste de l'espace client devient accessible.

- [ ] **K2** — La double authentification du client est active.

### Scène K3 — Partir et revenir

> **Qui :** Paul. **Où :** son espace client.

**Ce que vous faites**

1. Cliquez sur votre nom en haut à droite et déconnectez-vous.
2. Reconnectez-vous : e-mail, mot de passe, cochez **Rester connecté**, cliquez sur **Se connecter**, puis tapez le code à
   6 chiffres et cliquez sur **Vérifier**.

**Ce que vous devez constater** : la connexion réussit ; grâce à **Rester connecté**, cet ordinateur devient un « appareil
de confiance ».

- [ ] **K3** — Déconnexion et reconnexion fonctionnent.

### Scène K4 — Le tableau de bord de Paul

*La première chose que voit Paul, c'est le tableau de bord de son projet. Rien n'a encore commencé, mais tout y est déjà.*

> **Qui :** Paul. **Où :** menu **Tableau de bord**.

**Ce que vous devez constater**

- La référence et le nom du projet (« TEST — Villa Mballa »).
- Le montant du contrat (25 000 000 hors taxes, plus la TVA).
- La frise des jalons.
- Aucun montant payé pour l'instant.
- **Aucune donnée d'un autre client.**

- [ ] **K4** — Le tableau de bord est juste et ne montre que le projet de Paul.

### Scène K5 — La visite de toutes les pièces

*Paul ouvre chaque porte de son espace, une à une. La plupart des pièces sont encore vides, et c'est normal : rien n'a
encore été publié pour lui.*

> **Qui :** Paul. **Où :** tout le menu de l'espace client.

**Ce que vous faites** : cliquez successivement sur Passeport projet, Chantier, Planning, Finances, Documents, Preuves
certifiées, Validations, Immersion (maquette 3D, configurateur, live), Messagerie, Appels, Mon bâtiment, Énergie, SAV,
Dossier Tranquillité, Mon avis, Notifications et Mon compte.

**Ce que vous devez constater**

- Chaque page s'ouvre sans erreur, et une page vide l'explique clairement (« Aucune image publiée », « Aucun document
  publié »…).
- Les menus **Financement** et **Parrainage** n'apparaissent pas : ils ne seront ouverts qu'au chapitre 11.

- [ ] **K5** — Toutes les pages de l'espace client s'ouvrent proprement.

### Scène K6 — Le chantier dans la poche

*Paul installe l'application GLOBUS Client sur son téléphone, pour suivre son chantier partout.*

> **Qui :** Paul. **Où :** le téléphone, application **GLOBUS Client**.

**Ce que vous faites**

1. Ouvrez l'application GLOBUS Client.
2. Saisissez l'e-mail et le mot de passe de Paul, cochez **Rester connecté**, touchez **Se connecter**, puis tapez le code
   à 6 chiffres et touchez **Vérifier**.
3. Parcourez les onglets du bas : **Accueil**, **Chantier**, **Finances**, **Messages**, **Plus**.
4. Allez dans *Mon compte*, onglet **Notifications**, touchez **Activer le push** et acceptez les notifications du
   téléphone, puis touchez **Envoyer une notification de test**.

**Ce que vous devez constater** : les mêmes informations que sur l'ordinateur, et une notification de test qui apparaît en
haut de l'écran du téléphone.

- [ ] **K6** — L'application client fonctionne et reçoit les notifications.

---

# Livre IV — Le chantier se prépare

*Le contrat est signé, Paul a ses clés. Mais une maison ne se construit pas avec un contrat. Il faut un plan, une équipe,
du ciment, des électriciens. Ce livre raconte les semaines de préparation, celles que le client ne voit pas mais dont
tout dépend.*

## Chapitre 7 — Samuel monte le projet

*Samuel Fotso est ingénieur. Il aime les plannings bien tenus, les plans à jour et les risques anticipés. La Villa
Mballa est désormais son projet. Tout ce chapitre se passe dans la fiche du projet : dans le menu de gauche de l'ERP,
sous **Projets**, cliquez sur **Chantiers**, puis sur la ligne « TEST — Villa Mballa ». La fiche du projet possède de
nombreux onglets en haut de la page ; chaque scène vous dira lequel ouvrir.*

### Scène M1 — Compléter la carte d'identité du projet

> **Qui :** Samuel (profil **GLOBUS CDP**). **Où :** fiche du projet, onglet **Synthèse**.

**Ce que vous faites**

1. Dans l'onglet **Synthèse**, sur le bloc **Informations**, cliquez sur **Modifier**.
2. Complétez : l'adresse, la ville `Douala`, les coordonnées GPS du terrain (latitude et longitude ; vous pouvez prendre
   celles de votre position, lues dans l'application Google Maps de votre téléphone en appuyant longuement sur votre
   point bleu), la surface `180`, `2` niveaux, l'univers.
3. Cochez **Visible par le client**.
4. Enregistrez.

**Ce que vous devez constater** : les informations sont à jour, et les indicateurs du projet (budget, engagé, facturé…)
s'affichent.

- [ ] **M1** — La fiche du projet est complète.

### Scène M2 — Former l'équipe du projet

*Un projet sans équipe n'est qu'une idée. Samuel y fait entrer Ernest, Moussa, Linda et Rachel. Être membre d'un projet,
c'est ce qui ouvre la porte de ce projet à ceux qui ne voient pas tout.*

> **Qui :** Samuel. **Où :** onglet **Équipe**.

**Ce que vous faites** — quatre fois :

1. Cliquez sur **Ajouter un membre**.
2. Choisissez la personne et son rôle sur le projet : Ernest (chef de chantier), Moussa (technicien), Linda (acheteuse),
   Rachel (en cochant l'**accès aux finances**).
3. Validez.

**Ce que vous devez constater** : les quatre membres sont listés. Vérifiez dans la fenêtre d'Ernest (profil GLOBUS CDC) :
dans *Projets › Chantiers*, il voit désormais « TEST — Villa Mballa ».

- [ ] **M2** — L'équipe du projet est formée.

### Scène M3 — Le site et son périmètre invisible

*Le terrain de Paul s'appelle désormais « Parcelle Bonamoussadi ». Samuel dessine autour de lui un cercle invisible de
cent cinquante mètres : c'est dans ce cercle, et seulement dans ce cercle, que les ouvriers pourront pointer leur arrivée
avec leur téléphone.*

> **Qui :** Samuel. **Où :** onglet **Sites, phases, lots**.

**Ce que vous faites**

1. Cliquez sur **Nouveau site**.
2. **Code** : `S1`. **Nom** : `Parcelle Bonamoussadi`.
3. Indiquez les **coordonnées GPS** (les mêmes qu'en M1) et un **Rayon de géorepérage (m)** de `150`.
4. **Chef de chantier** : Ernest. Enregistrez.

**Ce que vous devez constater** : le site est créé. Il sera indispensable au pointage du chapitre 13.

> Astuce : pour tester le pointage sans aller physiquement à Bonamoussadi, mettez ici les coordonnées de l'endroit où vous
> vous trouvez.

- [ ] **M3** — Le site est créé avec son périmètre.

### Scène M4 — Découper la maison en lots et en phases

*Une maison se construit par morceaux : les lots (le gros œuvre, l'électricité…) et les phases (les fondations,
l'élévation…). Certains lots sont déjà nés du devis ; Samuel ajoute celui de l'électricité.*

> **Qui :** Samuel. **Où :** onglet **Sites, phases, lots**.

**Ce que vous faites**

1. Vérifiez la présence des lots créés automatiquement depuis le devis.
2. Cliquez sur **Nouveau lot** : code `LOT-ELEC`, nom `Électricité`, discipline électricité, budget `2 000 000`.
   Enregistrez.
3. Cliquez sur **Nouvelle phase** : `Fondations`, cochez **Visible par le client**. Enregistrez.
4. Recommencez avec une phase `Élévation`.

**Ce que vous devez constater** : les lots et les phases apparaissent.

- [ ] **M4** — La structure du projet est en place.

### Scène M5 — Les grandes étapes de paiement

*Les jalons sont les bornes kilométriques du chantier. Trois d'entre eux déclenchent un paiement de Paul.*

> **Qui :** Samuel. **Où :** onglet **Jalons**.

**Ce que vous faites**

1. Vérifiez que les trois jalons du contrat sont là, avec leur **Part de paiement (%)** : 30, 40 et 30.
2. Cliquez sur **Nouveau jalon** : `Implantation`, une date d'échéance, cochez **Visible par le client**, sans part de
   paiement. Enregistrez.

**Ce que vous devez constater** : quatre jalons, dont trois liés à un paiement.

- [ ] **M5** — Les jalons sont corrects.

### Scène M6 — Le planning

*Samuel ouvre le planning comme on déroule une carte. Quatre tâches, l'une après l'autre : on n'élève pas les murs avant
d'avoir coulé les fondations. Il les relie entre elles, demande à la plateforme de calculer les dates, puis fige ce
planning comme référence : c'est la promesse faite à Paul.*

> **Qui :** Samuel. **Où :** onglet **Planning**.

**Ce que vous faites**

1. Cliquez quatre fois sur **Nouvelle tâche** pour créer : `Implantation`, `Terrassement`, `Fondations`,
   `Élévation murs`. Pour chacune, indiquez des dates, une durée et un lot. Cochez **Visible par le client** pour deux
   d'entre elles.
2. Dans le **Diagramme de Gantt** (les barres horizontales), cliquez sur **Dépendance** et reliez les tâches deux à deux,
   en type « fin-début » : Implantation avant Terrassement, Terrassement avant Fondations, Fondations avant Élévation.
3. Cliquez sur **Ordonnancer (CPM)** : la plateforme recalcule toutes les dates.
4. Cliquez sur **Figer une référence**, nommez-la `Contrat`, et validez.

**Ce que vous devez constater**

- Le Gantt est cohérent : les barres s'enchaînent, et le **chemin critique** (les tâches qui ne peuvent pas prendre de
  retard sans retarder toute la maison) est en rouge.
- La référence « Contrat » apparaît dans **Références de planning (baselines)**.

- [ ] **M6** — Le planning est construit et figé.

### Scène M7 — Le planning qui regarde la météo

*Chaque matin, la plateforme scrute les risques des trente prochains jours : la pluie annoncée, une livraison en retard,
une absence. Samuel lui demande de le faire tout de suite.*

> **Qui :** Samuel. **Où :** onglet **Planning**, bloc **Planning intelligent**.

**Ce que vous faites**

1. Cliquez sur **Analyser maintenant**.
2. Si un risque apparaît, cliquez sur **Écarter** et indiquez un motif.

**Ce que vous devez constater** : l'analyse s'exécute ; elle affiche des risques ou indique qu'il n'y en a aucun.

- [ ] **M7** — L'analyse des risques de planning fonctionne.

### Scène M8 — Le budget de référence

*Rachel vérifie le budget né du contrat. Grâce l'approuve : c'est à lui qu'on comparera toutes les dépenses pour savoir si
le chantier gagne ou perd de l'argent.*

> **Qui :** Rachel (profil **GLOBUS FIN**), puis Grâce (profil **GLOBUS DIR**). **Où :** onglet **Budget**.

**Ce que vous faites**

1. Rachel ouvre l'onglet **Budget** et vérifie la version « Budget initial (contrat) ». Au besoin, elle crée une
   **Nouvelle version**.
2. Grâce ouvre la même version et clique sur **Approuver**.

**Ce que vous devez constater** : la version approuvée devient la référence des marges. Si Rachel a créé elle-même une
version, elle ne peut pas l'approuver : c'est la séparation des tâches, ce n'est pas une anomalie.

- [ ] **M8** — Le budget de référence est approuvé.

### Scène M9 — Le plan du rez-de-chaussée

*Dans le classeur numérique de l'entreprise (la GED, pour « gestion électronique des documents »), Samuel dépose le plan
du rez-de-chaussée. Il le soumet à Grâce, qui le valide, puis le publie « bon pour exécution ». Plus tard, une nouvelle
version remplacera la première, qui deviendra obsolète.*

> **Qui :** Samuel, puis Grâce. **Où :** ERP, *Projets › GED*.

**Ce que vous faites**

1. Samuel clique sur **Déposer un document** : projet « TEST — Villa Mballa », type **plan**, discipline architecture,
   titre `Plan RDC`, confidentialité normale, fichier PDF « Plan RDC ». Il clique sur **Déposer**.
2. Dans la fiche du document, il fait passer la version **En revue**, en ajoutant une étape avec Grâce comme approbatrice.
3. Grâce, notifiée, ouvre le document et clique sur **Valider**.
4. Samuel clique sur **Publier**.
5. Samuel clique ensuite sur **Nouvelle version**, dépose le PDF « Plan RDC v2 », puis refait le circuit (en revue,
   validation par Grâce, publication).

**Ce que vous devez constater** : la version publiée porte la mention « bon pour exécution » ; après la publication de la
version 2, la première devient obsolète.

- [ ] **M9** — Le circuit d'approbation et de publication d'un plan fonctionne.

### Scène M10 — Le plan arrive chez Paul

*Paul attend de voir ses plans. Samuel coche une case, et le plan apparaît dans l'espace client.*

> **Qui :** Samuel, puis Paul. **Où :** fiche du document dans la GED, puis espace client.

**Ce que vous faites**

1. Samuel ouvre la fiche de « Plan RDC », clique sur **Propriétés**, coche la visibilité **client** et enregistre.
2. Paul (profil GLOBUS CLI) ouvre le menu **Documents** de son espace, puis clique sur **Ouvrir** à côté de « Plan RDC ».
3. Paul clique sur **Authenticité**.

**Ce que vous devez constater**

- Paul voit « Plan RDC » (seulement la version en vigueur).
- Le document qu'il ouvre porte un filigrane à son nom.
- La page d'authenticité confirme que c'est bien le document publié par GLOBUS.

- [ ] **M10** — Le client voit le plan publié, filigrané et authentifié.

### Scène M11 — La maquette en trois dimensions (si vous en avez une)

*Si l'architecte a produit une maquette numérique (un fichier IFC ou RVT), Samuel la dépose dans le Hub BIM : Paul pourra
alors tourner autour de sa maison avant qu'elle n'existe.*

> **Qui :** Samuel. **Où :** ERP, *Projets › Hub BIM*, onglet **Maquettes**.

**Ce que vous faites**

1. Cliquez sur **Nouvelle maquette** (nom et discipline).
2. Cliquez sur **Nouvelle version**, déposez le fichier et cliquez sur **Déposer**.
3. Attendez que le statut indique « prête » (la conversion peut prendre plusieurs minutes), puis cliquez sur **Valider**,
   puis sur **Publier**.
4. Dans l'onglet **Maquette fédérée**, créez une issue localisée (un point de la maquette où un problème est signalé).

**Ce que vous devez constater** : la maquette s'affiche en 3D ; l'issue est localisée ; Paul voit la maquette dans le
menu **Immersion** de son espace. **Sans fichier de maquette, passez cette scène et notez-la « non testée ».**

- [ ] **M11** — La maquette 3D est publiée (ou scène notée « non testée »).

### Scène M12 — Le QR code du séjour

*Sur le futur chantier, chaque pièce aura son QR code collé au mur. En le scannant, un ouvrier verra les plans et les
tâches de cette pièce, et seulement ceux-là.*

> **Qui :** Samuel. **Où :** *Hub BIM*, onglet **Zones**.

**Ce que vous faites**

1. Cliquez sur **Nouvelle zone** : nom `Séjour RDC` (et un code). Enregistrez.
2. Cliquez sur **QR de la zone**, puis sur **Imprimer**.

**Ce que vous devez constater** : le QR code s'imprime. Gardez-le : il servira au chapitre 10.

- [ ] **M12** — Le QR code de la zone est imprimé.

### Scène M13 — La réunion de lancement

*Samuel invite Paul et Ernest à une réunion de lancement, en visioconférence, demain à dix heures.*

> **Qui :** Samuel. **Où :** ERP, *Projets › Agenda*.

**Ce que vous faites**

1. Cliquez sur **Nouvel événement**.
2. **Titre** : `Réunion de lancement`. **Type** : visite client. **Date** : demain, `10:00`. **Projet** : TEST — Villa
   Mballa. **Participants** : Paul et Ernest. Cochez la visioconférence.
3. Cliquez sur **Créer l'événement**.
4. Dans la fenêtre de Paul, menu **Planning**, retrouvez l'événement et cliquez sur **Ajouter à mon calendrier (.ics)**.

**Ce que vous devez constater** : Paul et Ernest sont notifiés ; l'événement apparaît dans le planning de l'espace client ;
le fichier .ics se télécharge et peut s'ouvrir dans un agenda (Outlook, Google Agenda, téléphone).

- [ ] **M13** — L'agenda et les invitations fonctionnent.

### Scène M14 — La saison des pluies

*Samuel connaît Douala. Il inscrit un risque dans le registre : la saison des pluies.*

> **Qui :** Samuel. **Où :** onglet **Risques** de la fiche projet.

**Ce que vous faites** : cliquez sur **Nouveau risque** : titre `Saison des pluies`, une probabilité, un impact, une
**Exposition financière** de `500 000`. Enregistrez.

**Ce que vous devez constater** : le risque apparaît dans le registre.

- [ ] **M14** — Le registre des risques fonctionne.

### Scène M15 — Le panneau de chantier

*Devant chaque chantier se dresse un panneau. Celui de GLOBUS porte un QR code : un passant curieux le scanne et découvre
le projet, son permis, son avancement.*

> **Qui :** Samuel. **Où :** onglet **Panneau connecté**.

**Ce que vous faites**

1. Renseignez le **Titre affiché**, la **Localisation affichée** (le quartier, jamais l'adresse exacte), l'**Entreprise**,
   le **N° du permis de bâtir**, et activez les interrupteurs **Avancement** et **Photos**.
2. Cliquez sur **Enregistrer**, puis sur **Publier**.
3. Cliquez sur **Panneau A3 (PDF)**.
4. Scannez le QR code du PDF avec un téléphone.

**Ce que vous devez constater** : le PDF du panneau contient un QR code ; une fois scanné, il ouvre la page publique du
chantier.

- [ ] **M15** — Le panneau connecté est publié.

## Chapitre 8 — Le ciment de Martin

*Avant de couler les fondations, il faut du ciment. Cent sacs. Ce chapitre suit leur voyage, de la demande d'Ernest
jusqu'au paiement de Martin, en passant par l'approbation de Grâce, la commande de Linda, la livraison et la réception
sur le chantier. C'est un voyage où chacun joue son rôle, et où personne ne peut tout faire seul.*

### Scène H1 — Le dépôt du chantier et son premier article

*Ernest, qui fait aussi office de magasinier, prépare l'endroit où l'on rangera le ciment : un petit dépôt sur le
chantier.*

> **Qui :** Ernest (profil **GLOBUS CDC**). **Où :** ERP, *Achats et logistique › Stocks*, onglet **Articles, dépôts,
> emplacements**.

**Ce que vous faites**

1. Cliquez sur **Nouveau dépôt** : code `DEP-S1`, type **chantier**, projet TEST — Villa Mballa. Enregistrez.
2. Cliquez sur **Nouvel article** : référence `CIM-425`, nom `Ciment CPJ 42.5`, unité **sac**, **Seuil d'alerte** `20`.
   Enregistrez.

**Ce que vous devez constater** : le dépôt et l'article apparaissent dans les listes.

- [ ] **H1** — Le dépôt et l'article existent.

### Scène H2 — Ernest a besoin de ciment

> **Qui :** Ernest. **Où :** ERP, *Achats et logistique › Achats*, onglet **Demandes d'achat**.

**Ce que vous faites**

1. Cliquez sur **Nouvelle demande**.
2. **Projet** : TEST — Villa Mballa. Ajoutez une ligne : l'article ciment, quantité `100` sacs, prix estimé `5200`.
3. **Urgence** : normale. **Besoin pour le** : dans cinq jours.
4. Cochez **Soumettre immédiatement**, puis enregistrez.

**Ce que vous devez constater** : la demande passe au statut « soumise », et l'approbatrice (Grâce) est notifiée.

- [ ] **H2** — La demande d'achat est soumise.

### Scène H3 — Grâce dit oui

*Dans son bureau, Grâce voit arriver la demande. Elle vérifie le besoin, le montant, le circuit d'approbation, et
approuve. Ernest, lui, n'avait aucun moyen d'approuver sa propre demande.*

> **Qui :** Grâce (profil **GLOBUS DIR**). **Où :** *Achats*, onglet **Mes approbations**.

**Ce que vous faites**

1. Ouvrez la demande d'Ernest.
2. Lisez le **Besoin exprimé** et le **Circuit d'approbation**.
3. Cliquez sur **Approuver**, puis sur **Confirmer**.
4. Vérification : dans la fenêtre d'Ernest, ouvrez sa demande. Aucun bouton ne lui permet de l'approuver lui-même.

**Ce que vous devez constater** : la demande passe « approuvée ».

- [ ] **H3** — L'approbation fonctionne et respecte la séparation des tâches.

### Scène H4 — Linda choisit le fournisseur et commande

*Linda, l'acheteuse, demande à la plateforme de classer les fournisseurs : prix, délai, qualité, stock, zone de
livraison. Martin arrive en tête. Linda commande.*

> **Qui :** Linda (profil **GLOBUS ACH**). **Où :** la demande approuvée, dans *Achats*.

**Ce que vous faites**

1. Ouvrez la demande approuvée. Dans le bloc **Choix du fournisseur**, cliquez sur **Classer les fournisseurs**.
2. Sur la ligne « TEST Quincaillerie du Wouri », cliquez sur **Commander**.
3. Vérifiez les lignes, les prix, la date prévue et l'adresse de livraison, puis cliquez sur **Créer le bon de commande**.
4. Ouvrez le bon de commande (onglet **Bons de commande**), cliquez sur **PDF** pour le voir, puis sur **QR réception** et
   imprimez ce QR code.

**Ce que vous devez constater** : le bon de commande est créé, son PDF est correct, et le QR de réception est imprimé
(il servira à Ernest à la scène H8).

- [ ] **H4** — Le bon de commande est créé.

### Scène H5 — La commande part chez Martin

> **Qui :** Linda. **Où :** la fiche du bon de commande.

**Ce que vous faites** : cliquez sur **Envoyer au fournisseur**, choisissez le canal **e-mail**, écrivez un court message
et cliquez sur **Envoyer**.

**Ce que vous devez constater** : le statut passe « envoyée », et un e-mail arrive sur l'adresse `+fournisseur`.

- [ ] **H5** — La commande est envoyée au fournisseur.

### Scène H6 — Martin répond

*Dans sa quincaillerie, Martin ouvre son extranet. Il ne voit que ses propres commandes, jamais celles des autres
fournisseurs ni leurs prix. Il tente sa chance avec un petit rabais… puis confirme.*

> **Qui :** Martin (profil **GLOBUS FOU**), puis Linda. **Où :** extranet, menu *Fournitures › Commandes*.

**Ce que vous faites**

1. Martin ouvre sa commande. Vérifiez qu'il ne voit aucune donnée d'un autre fournisseur.
2. Martin clique sur **Proposer une contre-offre** : prix unitaire proposé `5000`, son nom, un message. Il envoie.
3. Linda, dans l'ERP, ouvre le bon de commande et clique sur **Accepter la contre-offre**.
4. Martin clique sur **Confirmer la commande** (son nom, un commentaire facultatif).

**Ce que vous devez constater** : côté Linda, la commande passe « confirmée », au nouveau prix.

- [ ] **H6** — La contre-offre et la confirmation fonctionnent.

### Scène H7 — Le camion est en route

> **Qui :** Martin. **Où :** extranet, sa commande.

**Ce que vous faites** : cliquez sur **Annoncer une expédition** : arrivée estimée demain, un transporteur, un numéro de
bon de livraison, un chauffeur. Cliquez sur **Annoncer**.

**Ce que vous devez constater** : la livraison apparaît dans l'ERP (*Achats et logistique › Livraisons*) et dans
l'extranet de Martin (*Fournitures › Livraisons*) ; Ernest est prévenu.

- [ ] **H7** — L'expédition est annoncée.

### Scène H8 — Le camion arrive à Bonamoussadi

*Le camion se gare devant le chantier. Ernest compte les sacs : quatre-vingt-dix-huit en bon état, deux percés. Il les
refuse, photographie le bon de livraison, et valide la réception depuis son téléphone.*

> **Qui :** Ernest. **Où :** le téléphone, application **GLOBUS Terrain**.

**Ce que vous faites**

1. Ouvrez GLOBUS Terrain et connectez-vous avec le compte d'Ernest (e-mail, mot de passe, code).
2. Touchez **Scanner**, puis visez le QR de réception imprimé à la scène H4.
3. Indiquez `98` reçus et `2` refusés, avec le motif `sacs percés`.
4. Ajoutez une photo et le bon de livraison, puis touchez **Valider la réception**.

**Ce que vous devez constater**

- La réception est validée.
- Un incident fournisseur est créé automatiquement pour les deux sacs refusés.
- Le stock du dépôt DEP-S1 augmente de 98 sacs.

> Sans téléphone, la même réception peut se faire dans l'ERP : *Achats et logistique › Livraisons*, onglet
> **Réceptions**, **Nouvelle réception**.

- [ ] **H8** — La réception est faite, l'écart est signalé, le stock est à jour.

### Scène H9 — Les sacs vivent leur vie

*Trente sacs partent vers la bétonnière. Vingt-cinq sont gâchés, cinq reviennent au dépôt. Chaque mouvement est tracé, et
le coût des sacs consommés est imputé au chantier.*

> **Qui :** Ernest. **Où :** ERP, *Achats et logistique › Stocks*.

**Ce que vous faites**

1. Onglet **État du stock** : vérifiez les 98 sacs dans DEP-S1 et leur valeur. Onglet **Mouvements** : l'entrée apparaît.
2. Onglet **Affectations chantier** : cliquez sur **Réserver pour un chantier** (article ciment, dépôt DEP-S1, projet
   TEST, quantité `30`).
3. Sur cette réservation, cliquez sur **Sortir** (30), puis **Consommé** (25), puis **Retour** (5).

**Ce que vous devez constater** : le coût de 25 sacs apparaît dans les dépenses du projet (fiche projet, onglet
**Budget**, liste **Dépenses**).

- [ ] **H9** — Les mouvements de stock et l'imputation des coûts fonctionnent.

### Scène H10 — La facture de Martin

> **Qui :** Martin. **Où :** extranet, sa commande.

**Ce que vous faites**

1. Cliquez sur **Déposer une facture**.
2. **Numéro de votre facture** : `FAC-TEST-001`. Une date, une échéance, le montant de TVA. Les quantités sont
   préremplies (98).
3. Joignez le PDF « facture fournisseur » et cliquez sur **Déposer la facture**.

**Ce que vous devez constater** : la facture apparaît dans *Facturation › Factures* de l'extranet, avec un **Contrôle**
« Conforme ».

- [ ] **H10** — La facture fournisseur est déposée.

### Scène H11 — Rachel vérifie les trois pièces

*Rachel a une règle d'or : on ne paie une facture que si elle correspond à la commande et à ce qui a été réellement reçu.
Commande, réception, facture : les trois pièces doivent dire la même chose.*

> **Qui :** Rachel (profil **GLOBUS FIN**), puis Grâce. **Où :** ERP, *Finance › Facturation*, onglet **Factures
> fournisseurs**.

**Ce que vous faites**

1. Ouvrez la facture `FAC-TEST-001` et cliquez sur **Rapprocher**.
2. Vérifiez que commande, réception et facture concordent, puis cliquez sur **Valider (bon à payer)**.
3. Contre-épreuve : avec **Saisir une facture**, créez une seconde facture de Martin pour la même commande, avec un prix
   plus élevé. Elle doit partir dans l'onglet **Anomalies 3 pièces**. Grâce l'ouvre, clique sur **Arbitrer** et la rejette.

**Ce que vous devez constater** : la bonne facture est « bon à payer » ; la facture trop chère est arrêtée et arbitrée.

- [ ] **H11** — Le rapprochement des trois pièces protège des erreurs.

### Scène H12 — L'ordre de paiement

> **Qui :** Rachel. **Où :** la facture « bon à payer ».

**Ce que vous faites**

1. Sur la facture, cliquez sur **Payer** (ou, au choix, *Finance › Finances*, onglet **Paiements**, **Ordre de paiement**).
2. Indiquez le montant, le mode **virement** et la date, puis cliquez sur **Créer l'ordre de paiement**.

**Ce que vous devez constater** : l'ordre de paiement est créé au statut « à approuver ».

- [ ] **H12** — L'ordre de paiement est créé.

### Scène H13 — Le double regard

*Rachel essaie d'approuver elle-même son ordre de paiement. La plateforme refuse : il faut une seconde personne. C'est
Grâce qui approuvera.*

> **Qui :** Rachel, puis Grâce. **Où :** *Finance › Finances*, onglet **Paiements**.

**Ce que vous faites**

1. Rachel ouvre son ordre de paiement et tente de cliquer sur **Approuver**.
2. Grâce ouvre le même paiement et clique sur **Approuver**.

**Ce que vous devez constater** : la tentative de Rachel est refusée (« une seconde personne est requise ») ; celle de
Grâce réussit, et le paiement passe « approuvé ».

- [ ] **H13** — Le double regard fonctionne.

### Scène H14 — L'argent part

*Le virement a été fait à la banque. Rachel l'enregistre dans la plateforme, avec sa preuve et sa référence. Cette
référence, « VIR-TEST-0001 », servira à retrouver le virement sur le relevé bancaire au chapitre 12.*

> **Qui :** Rachel. **Où :** le paiement approuvé.

**Ce que vous faites**

1. Ouvrez le paiement approuvé et cliquez sur **Exécuter**.
2. Choisissez le mode **Virement / Mobile Money effectué hors plateforme (preuve jointe)**.
3. **Référence bancaire / Mobile Money** : `VIR-TEST-0001`. Joignez le PDF de preuve de virement.
4. Cliquez sur **Confirmer l'exécution**.

**Ce que vous devez constater** : le paiement passe « payé », la facture aussi, et Martin voit le règlement dans son
extranet (*Facturation › Paiements*).

- [ ] **H14** — Le paiement est exécuté et visible du fournisseur.

### Scène H15 — Noter Martin

*Linda prend une minute pour noter la prestation de Martin : la qualité, le délai, le service. Ces notes nourrissent le
classement des fournisseurs pour les prochaines commandes.*

> **Qui :** Linda. **Où :** le bon de commande.

**Ce que vous faites** : cliquez sur **Noter le fournisseur** (par exemple qualité 4 sur 5), validez, puis cliquez sur
**Clôturer**.

**Ce que vous devez constater** : le bon de commande est clôturé ; la note apparaît dans l'onglet **Performance** de la
fiche fournisseur, et Martin la voit dans *Fournitures › Performance* de son extranet.

- [ ] **H15** — La notation et la clôture fonctionnent.

### Scène H16 — Les papiers de Martin

*Un fournisseur sérieux tient ses attestations à jour. Martin dépose son attestation fiscale ; Linda la vérifie.*

> **Qui :** Martin, puis Linda. **Où :** extranet, *Fournitures › Documents* ; puis ERP, fiche fournisseur.

**Ce que vous faites**

1. Martin clique sur **Déposer un document** : type attestation fiscale, un intitulé, une date de validité, le PDF
   d'attestation. Il clique sur **Déposer**.
2. Linda ouvre la fiche du fournisseur, onglet **Documents**, et clique sur **Marquer vérifié**.

**Ce que vous devez constater** : dans l'extranet de Martin, le document passe « vérifié par GLOBUS ».

- [ ] **H16** — Les documents légaux du fournisseur sont gérés.

## Chapitre 9 — Les électriciens d'Akwa

*L'électricité d'une maison ne s'improvise pas. GLOBUS va confier ce lot à une entreprise spécialisée, mais pas sans
précautions : vérifier ses références, la mettre en concurrence, signer un vrai marché, contrôler chaque mètre de câble
déclaré avant de payer. C'est l'histoire de Sylvie Abena et de son entreprise, TEST Électricité Akwa.*

### Scène S1 — L'examen de passage

*Avant d'inviter Sylvie à remettre une offre, Samuel vérifie que son entreprise est sérieuse : ses références, sa
capacité, sa sécurité, sa solidité financière.*

> **Qui :** Samuel (profil **GLOBUS CDP**). **Où :** ERP, *Sous-traitance › Sous-traitants*.

**Ce que vous faites**

1. Ouvrez la fiche « TEST Électricité Akwa » et cliquez sur **Qualifier**.
2. **Corps de métier** qualifié : électricité.
3. Donnez une note de 4 sur 5 à chaque critère (références, capacité, sécurité, solidité financière, qualité). Le score
   sur 100 se calcule sous vos yeux.
4. Ajoutez une référence de chantier (bouton **Référence** : un projet, un client, une année, un montant).
5. Déposez une pièce justificative (un PDF), puis choisissez la décision « approuver » et enregistrez.

**Ce que vous devez constater** : le score atteint au moins 50, et l'entreprise passe au statut « qualifié ».

- [ ] **S1** — Le sous-traitant est qualifié.

### Scène S2 — L'appel d'offres

*Samuel lance une consultation pour le lot électricité : un tableau électrique et trente points lumineux. Pour que
l'essai ne dure pas des jours, la date limite de remise des offres est fixée dans dix minutes.*

> **Qui :** Samuel. **Où :** *Sous-traitance › Sous-traitants*, onglet **Consultations**.

**Ce que vous faites**

1. Cliquez sur **Nouvelle consultation**.
2. **Projet** : TEST — Villa Mballa. **Titre** : `Lot électricité`. **Date limite** : dans 10 minutes. Cochez le **pli
   scellé**. Ajoutez un document au dossier.
3. Cliquez sur **Ajouter un lot**, puis ajoutez deux postes (bouton **Poste**) : « Tableau électrique », unité « u »,
   quantité `1` ; « Points lumineux », unité « u », quantité `30`.
4. Cliquez sur **Créer la consultation**, puis sur **Publier**.
5. Cliquez sur **Inviter**, choisissez « TEST Électricité Akwa » et validez.

**Ce que vous devez constater** : Sylvie est notifiée de l'invitation.

- [ ] **S2** — La consultation est publiée et Sylvie est invitée.

### Scène S3 — Sylvie remet son offre

*Dans son bureau d'Akwa, Sylvie étudie le dossier et chiffre son offre. Elle la dépose sous « pli scellé » : personne,
chez GLOBUS, ne pourra en voir le montant avant la date limite.*

> **Qui :** Sylvie (profil **GLOBUS STT**). **Où :** extranet, *Sous-traitance › Consultations*.

**Ce que vous faites**

1. Ouvrez la consultation « Lot électricité ».
2. Sur le lot, cliquez sur **Remettre une offre**.
3. Saisissez les prix unitaires : `350000` pour le tableau, `25000` pour les points lumineux. **Délai d'exécution
   proposé** : `20` jours. Joignez le PDF « mémoire technique ».
4. Cliquez sur **Déposer l'offre**.
5. Dans la fenêtre de Samuel, ouvrez la consultation.

**Ce que vous devez constater** : chez Sylvie, « Offre déposée » ; chez Samuel, l'offre existe mais son montant reste
**invisible** tant que la date limite n'est pas passée.

- [ ] **S3** — L'offre est déposée et reste scellée.

### Scène S4 — L'ouverture des plis

*Dix minutes ont passé. Samuel ouvre les plis, compare, évalue, négocie un peu, et attribue le lot.*

> **Qui :** Samuel (ou Grâce), puis Sylvie. **Où :** la consultation.

**Ce que vous faites**

1. Après la date limite, Samuel clique sur **Clôturer** : les plis s'ouvrent.
2. Il consulte le **Bordereau comparé**, puis clique sur **Évaluer** et donne une note technique.
3. Il clique sur **Négocier** et demande une contre-proposition.
4. Sylvie, dans son extranet, clique sur **Accepter …** (ou sur **Contre-proposer**, avec un montant, un délai et un
   commentaire).
5. Samuel clique sur **Attribuer**.

**Ce que vous devez constater** : un marché est créé en brouillon, dans l'onglet **Marchés**.

- [ ] **S4** — La consultation est clôturée et le lot attribué.

### Scène S5 — La signature électronique du marché

*Le marché est prêt. Sylvie le lit, puis le signe sans papier : son nom, sa qualité, une case cochée, et un code reçu
par e-mail.*

> **Qui :** Grâce ou Samuel, puis Sylvie. **Où :** onglet **Marchés** ; extranet, *Mes marchés*.

**Ce que vous faites**

1. Dans l'ERP, sur le marché en brouillon, cliquez sur **Envoyer pour signature**.
2. Sylvie ouvre *Mes marchés*, clique sur **Contrat PDF** pour le lire, puis sur **Signer le marché**.
3. Elle saisit son nom et sa qualité, coche la case d'acceptation, clique sur **Recevoir mon code**, tape le code reçu par
   e-mail et clique sur **Signer**.

**Ce que vous devez constater** : le marché passe « en cours », avec une signature horodatée.

- [ ] **S5** — Le marché est signé électroniquement.

### Scène S6 — Les électriciens arrivent

> **Qui :** Samuel. **Où :** la fiche du marché.

**Ce que vous faites** : cliquez sur **Mobilisation** : une date, un effectif de `4` personnes, le chantier S1. Validez.

**Ce que vous devez constater** : la mobilisation apparaît dans la fiche du marché.

- [ ] **S6** — La mobilisation est enregistrée.

### Scène S7 — La première situation de travaux

*Au bout de quelques semaines, Sylvie déclare ce qu'elle a fait : le tableau est posé, dix points lumineux aussi. C'est sa
« situation de travaux », la base de son paiement. Elle doit y joindre des photos : sans preuve, pas de paiement.*

> **Qui :** Sylvie. **Où :** extranet, *Mes marchés*.

**Ce que vous faites**

1. Ouvrez le marché et cliquez sur **Nouvelle situation**.
2. Indiquez la période (le mois en cours). Réalisé sur la période : tableau `1`, points lumineux `10`.
3. Cliquez sur **Créer la situation**, puis ouvrez-la.
4. Essai : cliquez sur **Soumettre** sans photo. La plateforme doit refuser.
5. Sélectionnez deux photos et cliquez sur **Envoyer les photos**, puis sur **Soumettre**.

**Ce que vous devez constater** : sans photo, la soumission est refusée ; avec photos, la situation passe « soumise ».

- [ ] **S7** — La situation est soumise avec ses preuves.

### Scène S8 — Ernest compte les points lumineux

*Ernest fait le tour de la maison et compte : neuf points lumineux, pas dix. Il l'écrit.*

> **Qui :** Ernest (profil **GLOBUS CDC**). **Où :** ERP, *Sous-traitance › Situations*.

**Ce que vous faites**

1. Ouvrez la situation de Sylvie et cliquez sur **Constat terrain**.
2. Quantités constatées : points lumineux `9`. Ajoutez une observation et une photo.
3. Cliquez sur **Enregistrer le constat**.

**Ce que vous devez constater** : la situation passe « contrôlée sur le terrain », et Sylvie voit dans son extranet
« Constaté » = 9.

- [ ] **S8** — Le constat terrain corrige la déclaration.

### Scène S9 — Grâce valide

> **Qui :** Grâce (profil **GLOBUS DIR**). **Où :** la situation contrôlée.

**Ce que vous faites** : cliquez sur **Valider**, lisez les montants calculés (montant de la période, retenue de
garantie, récupération d'avance), puis confirmez.

**Ce que vous devez constater** : la situation passe « validée ».

- [ ] **S9** — La situation est validée.

### Scène S10 — La facture de Sylvie et son paiement

*Sylvie dépose sa facture. Rachel la valide, prépare le paiement, Grâce l'approuve, Rachel l'exécute : le même circuit que
pour Martin.*

> **Qui :** Sylvie, puis Rachel et Grâce. **Où :** extranet ; puis ERP, *Sous-traitance › Sous-traitants*, onglet
> **Factures**, et *Finance › Finances*.

**Ce que vous faites**

1. Sylvie ouvre sa situation validée, clique sur **Déposer la facture** : un numéro, une date, le montant TTC, le PDF
   « facture sous-traitant ». Elle clique sur **Déposer**.
2. Rachel ouvre l'onglet **Factures** de la sous-traitance et clique sur **Valider (bon à payer)**.
3. Le paiement suit ensuite exactement les scènes H12, H13 et H14 : ordre de paiement par Rachel, approbation par Grâce,
   exécution par Rachel (choisissez une autre référence, par exemple `VIR-TEST-0003`).

**Ce que vous devez constater** : Sylvie voit sa facture « payée » et le paiement dans *Facturation › Paiements*.

- [ ] **S10** — La facture du sous-traitant est payée.

### Scène S11 — Sylvie réclame

*Sylvie estime avoir fait des travaux supplémentaires non prévus. Elle dépose une réclamation de 150 000 francs. Samuel
la refuse, réponse écrite à l'appui.*

> **Qui :** Sylvie, puis Samuel. **Où :** extranet, *Sous-traitance › Réclamations* ; ERP, onglet **Réclamations** des
> sous-traitants.

**Ce que vous faites**

1. Sylvie clique sur **Nouvelle réclamation** : le marché concerné, un objet, un exposé, un montant de `150000`. Elle
   clique sur **Déposer**.
2. Samuel ouvre la réclamation et clique sur **Répondre** : décision « refuser », avec une réponse écrite.

**Ce que vous devez constater** : Sylvie voit la réponse de Samuel dans son extranet.

- [ ] **S11** — Les réclamations circulent dans les deux sens.

### Scène S12 — Le litige

*Sylvie conteste le point lumineux manquant : 25 000 francs. Elle ouvre un litige. Pendant toute sa durée, ce montant est
« gelé » ; le reste de ses factures continue de vivre. Chaque échange s'inscrit dans une chronologie que personne ne peut
modifier.*

> **Qui :** Sylvie, puis Grâce. **Où :** extranet, *Litiges* ; ERP, *Sous-traitance › Litiges*.

**Ce que vous faites**

1. Sylvie clique sur **Ouvrir un litige** : le marché, la situation contestée, un exposé des faits, un montant contesté de
   `25000`, une pièce justificative. Elle clique sur **Ouvrir le litige**.
2. Grâce ouvre le litige, clique sur **Faire évoluer** (passage en analyse), puis sur **Ajouter à la chronologie** (un
   échange).
3. Grâce clique sur **Décision** (une décision motivée), puis sur **Clore (résolu)**.

**Ce que vous devez constater** : le montant est gelé pendant le litige puis libéré selon la décision ; la chronologie est
visible des deux côtés et ne peut pas être modifiée.

- [ ] **S12** — Le litige suit son cours jusqu'à sa résolution.

### Scène S13 — Trop, c'est trop

*Dernière épreuve : Sylvie déclare plus de points lumineux que le marché n'en prévoit. La plateforme bloque la
validation : il faut une dérogation explicite et justifiée.*

> **Qui :** Sylvie, puis Grâce. **Où :** extranet, puis ERP.

**Ce que vous faites**

1. Sylvie crée une nouvelle situation avec des quantités qui dépassent le marché (par exemple 40 points lumineux au
   total), joint des photos et la soumet.
2. Ernest enregistre un constat terrain.
3. Grâce tente de cliquer sur **Valider** : la validation doit être bloquée.
4. Grâce clique sur **Accorder une dérogation** et écrit une justification.

**Ce que vous devez constater** : la validation est bloquée tant qu'il n'y a pas de dérogation ; une fois la dérogation
accordée, elle devient possible.

- [ ] **S13** — Le dépassement de marché est contrôlé.

---

# Livre V — La vie du chantier

*Les fondations sont coulées, les électriciens sont à l'œuvre. Commence la longue vie du chantier : les journées
d'Ernest, les décisions de Paul, les chiffres de Rachel, les ouvriers, la sécurité, les machines. Ce livre est le cœur
battant de l'histoire.*

## Chapitre 10 — Une journée avec Ernest

*Six heures du matin, Bonamoussadi. Le soleil se lève à peine sur la parcelle. Ernest Tchoua enfile ses chaussures de
sécurité, glisse son téléphone dans la poche de sa chemise et ouvre GLOBUS Terrain. Toute la journée, c'est cette
application qui sera son carnet, son appareil photo, son talkie-walkie et son registre.*

Pour ce chapitre, utilisez le **téléphone** avec l'application **GLOBUS Terrain**, connectée au compte d'Ernest.

### Scène T1 — Le bonjour de l'application

> **Qui :** Ernest. **Où :** application GLOBUS Terrain.

**Ce que vous faites** : si ce n'est pas déjà fait, connectez-vous avec l'e-mail, le mot de passe et le code d'Ernest.

**Ce que vous devez constater** : sous la barre du haut s'affiche le **chantier courant**, « TEST — Villa Mballa », et
seules les rubriques correspondant aux métiers d'Ernest apparaissent (pas de finance, par exemple).

- [ ] **T1** — L'application s'ouvre sur le bon chantier.

### Scène T2 — L'implantation est terminée

*Ernest et son équipe ont planté les piquets qui dessinent la maison au sol. La tâche est terminée.*

> **Qui :** Ernest. **Où :** rubrique **Mes tâches**.

**Ce que vous faites** : ouvrez la tâche « Implantation », poussez le curseur d'avancement à `100 %` et ajoutez une photo.

**Ce que vous devez constater** : l'avancement du projet est recalculé, aussi bien dans l'ERP (fiche du projet) que dans
l'espace client de Paul.

- [ ] **T2** — L'avancement d'une tâche remonte partout.

### Scène T3 — Le journal du jour

*Le soir, Ernest rédige son journal : le temps qu'il a fait, combien d'ouvriers étaient là, ce qui a été réalisé. Il le
rend visible à Paul.*

> **Qui :** Ernest, puis Samuel, puis Paul. **Où :** application, rubrique **Journal de chantier** ; ERP, fiche projet,
> onglet **Journal de chantier** ; espace client, menu **Chantier**.

**Ce que vous faites**

1. Ernest rédige le rapport du jour : météo, effectif `6`, travaux réalisés, et coche **Visible par le client**. Il le
   soumet.
2. Samuel, dans l'ERP, ouvre le rapport soumis et clique sur **Valider**.
3. Paul ouvre le menu **Chantier** de son espace.

**Ce que vous devez constater** : Paul voit le rapport du jour.

- [ ] **T3** — Le journal de chantier va du terrain au client.

### Scène T4 — Les photos du jour

> **Qui :** Ernest, puis Samuel. **Où :** rubrique **Photos et vidéos** ; ERP, onglet **Photos et vidéos**.

**Ce que vous faites**

1. Ernest prend trois photos, choisit l'étape « pendant les travaux » et ajoute une légende.
2. Samuel ouvre l'onglet **Photos et vidéos** de la fiche projet.

**Ce que vous devez constater** : les trois photos sont dans l'ERP, avec leur position GPS. Elles ne sont **pas encore**
visibles de Paul : il faudra que Samuel les publie (chapitre 11).

- [ ] **T4** — Les photos arrivent dans l'ERP sans être publiées automatiquement.

### Scène T5 — Le rapport dicté

*Les mains pleines de ciment, Ernest préfère parler qu'écrire. Il dicte son rapport ; l'application le transforme en
texte, qu'il relit et valide.*

> **Qui :** Ernest. **Où :** rubrique **Rapports vocaux**.

**Ce que vous faites** : dictez une trentaine de secondes (« Aujourd'hui, coulage de la semelle de fondation côté nord,
six ouvriers présents, livraison de ciment reçue… »), puis relisez et validez le texte proposé.

**Ce que vous devez constater** : la transcription en français est fidèle.

- [ ] **T5** — La dictée vocale fonctionne.

### Scène T6 — Le QR code collé au mur

> **Qui :** Ernest. **Où :** bouton **Scanner** de l'application.

**Ce que vous faites** : touchez **Scanner** et visez le QR code de la zone « Séjour RDC » imprimé à la scène M12.

**Ce que vous devez constater** : l'application ouvre les plans autorisés, les tâches et les photos de cette zone, et ne
propose que la **version publiée** du plan.

- [ ] **T6** — Le scan d'une zone ouvre les bonnes informations.

### Scène T7 — Le plan périmé

*Danger classique des chantiers : travailler sur un vieux plan. Samuel publie une nouvelle version du plan ; sur le
téléphone d'Ernest, un bandeau rouge l'avertit aussitôt.*

> **Qui :** Samuel, puis Ernest. **Où :** ERP, GED ; application, rubrique **Plans et maquette**.

**Ce que vous faites**

1. Ernest ouvre une fois le « Plan RDC » sur son téléphone (il est ainsi téléchargé).
2. Samuel publie une nouvelle version de ce plan dans la GED (comme à la scène M9).
3. Ernest rouvre le plan sur son téléphone.

**Ce que vous devez constater** : un bandeau rouge **Plan périmé** prévient Ernest.

- [ ] **T7** — L'alerte de plan périmé fonctionne.

### Scène T8 — Le sac qui tombe

*Un sac de ciment glisse de l'échafaudage et s'écrase à un mètre d'un ouvrier. Personne n'est blessé, mais Ernest le
signale immédiatement : c'est ainsi qu'on évite le prochain accident.*

> **Qui :** Ernest. **Où :** rubrique **QHSE**, bouton **Signaler**.

**Ce que vous faites** : signalez un incident : nature « chute de matériel », gravité moyenne, circonstances, deux photos.

**Ce que vous devez constater** : l'incident apparaît dans l'ERP (*RH et QHSE › QHSE*, onglet **Incidents**), et le
responsable QHSE est notifié.

- [ ] **T8** — L'incident de sécurité est signalé.

### Scène T9 — La zone blanche

*À Bonamoussadi, le réseau va et vient. Ernest continue de travailler comme si de rien n'était : l'application garde tout
en mémoire, à l'abri, et envoie dès que le réseau revient.*

> **Qui :** Ernest. **Où :** le téléphone et l'application.

**Ce que vous faites**

1. Activez le **mode avion** du téléphone (en faisant glisser le haut de l'écran vers le bas, icône d'avion).
2. Dans l'application, saisissez : l'avancement d'une tâche, un journal, une photo, un incident.
3. Désactivez le mode avion.
4. Patientez jusqu'à deux minutes, ou tirez l'écran d'accueil vers le bas pour forcer l'envoi.

**Ce que vous devez constater**

- Pendant la coupure, un bandeau « hors ligne » s'affiche, et vos saisies sont conservées.
- Au retour du réseau, tout part automatiquement, et l'ERP reçoit chaque saisie **une seule fois** (aucun doublon).

- [ ] **T9** — Le mode hors ligne ne perd rien et ne duplique rien.

### Scène T10 — Deux versions de la vérité

*Pendant qu'Ernest est hors réseau, il modifie l'avancement d'une tâche. Au même moment, au bureau, Samuel modifie la même
tâche. Quand le réseau revient, qui a raison ? La plateforme ne choisit pas à leur place : elle leur montre les deux
versions et leur demande de trancher.*

> **Qui :** Ernest et Samuel. **Où :** application (rubrique **Synchronisation**) et ERP.

**Ce que vous faites**

1. Ernest active le mode avion et change l'avancement de la tâche « Terrassement ».
2. Samuel, dans l'ERP, change l'avancement de la même tâche.
3. Ernest désactive le mode avion.
4. Ernest ouvre **Synchronisation**, compare les colonnes « Bureau » et « Moi », puis choisit **Fusionner** (ou **Garder
   le bureau**, ou **Garder ma version**).

**Ce que vous devez constater** : la saisie d'Ernest passe en conflit au lieu d'écraser celle de Samuel ; après
l'arbitrage, une seule valeur reste ; l'arbitrage est tracé dans le journal d'audit.

- [ ] **T10** — Les conflits de synchronisation sont arbitrés proprement.

### Scène T11 — Cinq sacs pour la dalle

> **Qui :** Ernest. **Où :** rubrique **Stock chantier**.

**Ce que vous faites** : faites une sortie de `5` sacs de ciment vers le chantier (vous pouvez même le faire en mode
avion).

**Ce que vous devez constater** : le mouvement apparaît dans l'ERP (*Achats et logistique › Stocks*, onglet
**Mouvements**).

- [ ] **T11** — Les sorties de stock depuis le terrain fonctionnent.

### Scène T12 — Lire un bon de livraison en le photographiant

> **Qui :** Ernest. **Où :** rubrique **Lecture de documents**.

**Ce que vous faites** : photographiez un bon de livraison (n'importe quel document papier fera l'affaire).

**Ce que vous devez constater** : l'application propose les informations qu'elle a lues, mais ne les applique jamais sans
votre validation. Cette lecture dépend de l'intelligence artificielle, qui peut être indisponible (annexe A) : ce n'est
alors pas une anomalie, notez simplement « non testé ».

- [ ] **T12** — La lecture de documents fonctionne (ou notée « non testée »).

## Chapitre 11 — Paul suit, décide et paie

*À des kilomètres du chantier, Paul ouvre son espace client presque chaque soir. Il regarde les photos, il pose des
questions, il choisit son carrelage, il paie ses échéances. Ce chapitre raconte la relation entre un client et son
constructeur, telle que la plateforme la rend possible : transparente, tracée, et sans papier.*

### Scène R1 — Les photos arrivent chez Paul

*Samuel trie les photos d'Ernest. Il en choisit deux, nettes et rassurantes, et les publie.*

> **Qui :** Samuel (profil **GLOBUS CDP**), puis Paul (profil **GLOBUS CLI**). **Où :** fiche projet, onglet **Photos et
> vidéos** ; espace client, menu **Chantier**.

**Ce que vous faites**

1. Samuel active l'interrupteur **Client** sous deux des photos de la scène T4. (Il vérifie au passage qu'aucune photo
   interne, montrant par exemple un plan confidentiel, n'est publiée.)
2. Paul ouvre le menu **Chantier**, puis filtre par étape avec la liste **Toutes les étapes** ; il revient ensuite sur son
   **Tableau de bord**.

**Ce que vous devez constater** : les deux photos apparaissent dans le journal visuel de Paul et dans le bloc
« Dernières images du chantier » de son tableau de bord.

- [ ] **R1** — La publication des photos au client fonctionne.

### Scène R2 — Des photos qui font foi

*Une photo datée peut devenir une preuve, à condition que personne ne puisse la falsifier. Samuel « certifie » les photos
du jour : leur empreinte numérique est scellée, et n'importe qui pourra plus tard vérifier qu'elles n'ont pas été
retouchées.*

> **Qui :** Samuel, puis Paul. **Où :** fiche projet, onglet **Confiance et preuves** ; espace client, menu **Preuves
> certifiées**.

**Ce que vous faites**

1. Samuel clique sur **Certifier les photos du jour**, puis sur **Certificat** pour télécharger le PDF.
2. Paul ouvre **Preuves certifiées**, puis clique sur **Vérifier un fichier** et y dépose l'une des photos publiées.

**Ce que vous devez constater** : une preuve est créée ; le certificat PDF contient un QR code ; la vérification confirme
que l'empreinte du fichier correspond.

- [ ] **R2** — La certification des photos fonctionne.

### Scène R3 — Le choix du carrelage

*Samuel demande à Paul de choisir le carrelage du séjour. Deux options : un grès 60×60 sans supplément, ou un marbre, plus
beau, mais 1 500 000 francs de plus et cinq jours de délai supplémentaires.*

> **Qui :** Samuel. **Où :** fiche projet, onglet **Décisions**.

**Ce que vous faites**

1. Cliquez sur **Demander une décision**.
2. **Type** : matériau. **Titre** : `Carrelage séjour`.
3. Ajoutez deux options (bouton **Option**) : « Grès 60×60 » avec un impact prix de `0` ; « Marbre » avec un impact prix de
   `1 500 000` et un impact délai de `5` jours.
4. Fixez une **Date d'échéance**, puis validez.

**Ce que vous devez constater** : Paul est notifié, sous la cloche et par e-mail.

- [ ] **R3** — La demande de décision part chez le client.

### Scène R4 — Paul choisit le marbre

*Paul hésite une soirée entière, puis se décide : ce sera le marbre. Il confirme son choix avec un code reçu par e-mail.
Ce choix devient irréversible et horodaté, comme une signature. Et parce qu'il coûte plus cher, la plateforme prépare
automatiquement un avenant au contrat.*

> **Qui :** Paul. **Où :** espace client, menu **Validations**, onglet **Décisions**.

**Ce que vous faites**

1. Sur la décision « Carrelage séjour », cliquez sur **Valider**.
2. Choisissez l'option **Marbre** (l'impact prix et délai est rappelé).
3. Dans **Recevoir le code par**, choisissez e-mail, cliquez sur **Recevoir mon code**, tapez le **Code reçu**, puis
   confirmez.

**Ce que vous devez constater**

- La décision est « validée » et ne peut plus être modifiée.
- Un avenant est créé automatiquement pour l'impact prix.
- La validation apparaît dans le **Journal des validations** du menu **Passeport projet**, et dans *Mon compte*, onglet
  **Confiance et confidentialité**.

- [ ] **R4** — La décision est validée par code et figée.

### Scène R5 — Paul dit non

*Toutes les propositions ne plaisent pas. Samuel propose autre chose ; Paul refuse, en expliquant pourquoi.*

> **Qui :** Samuel, puis Paul. **Où :** onglet **Décisions** ; espace client, **Validations**.

**Ce que vous faites**

1. Samuel crée une seconde décision (par exemple « Couleur de la façade », avec deux options).
2. Paul clique sur **Refuser**, écrit un **Motif du refus** d'au moins cinq caractères, puis clique sur **Refuser**.

**Ce que vous devez constater** : Samuel est prévenu, et la décision passe « refusée ».

- [ ] **R5** — Le refus d'une décision fonctionne.

### Scène R6 — L'avenant

*Le marbre coûte plus cher : le contrat doit être modifié. C'est le rôle de l'avenant. Samuel le soumet à Paul, qui
l'approuve par code ; puis Rachel l'approuve à son tour côté finance, et le montant du contrat se met à jour partout.*

> **Qui :** Samuel, Paul, puis Rachel. **Où :** fiche projet, onglet **Avenants** ; espace client, **Validations**, onglet
> **Avenants**.

**Ce que vous faites**

1. Samuel ouvre l'avenant né de la scène R4 (ou crée un **Nouvel avenant** avec une **Ligne chiffrée**) et clique sur
   **Soumettre au client**.
2. Paul ouvre l'onglet **Avenants** de ses **Validations**, clique sur **Approuver**, reçoit et saisit son code, puis
   confirme avec **Approuver**.
3. Rachel ouvre l'avenant « approuvé client » et clique sur **Approuver (finance)**.

**Ce que vous devez constater** : le montant du contrat est mis à jour partout : dans l'ERP, sur le tableau de bord de
Paul et dans son Passeport projet.

- [ ] **R6** — L'avenant passe le double circuit client puis finance.

### Scène R7 — Le premier appel de fonds

*Le premier jalon est atteint : il est temps de demander à Paul les 30 % prévus à la signature. Rachel émet l'appel de
fonds ; une facture d'acompte se crée toute seule.*

> **Qui :** Rachel (profil **GLOBUS FIN**), puis Paul. **Où :** ERP, *Finance › Facturation*, onglet **Appels de fonds** ;
> espace client, menu **Finances**.

**Ce que vous faites**

1. Rachel clique sur **Nouvel appel de fonds** : projet TEST — Villa Mballa, jalon « signature 30 % », un libellé, le
   montant correspondant. Elle enregistre, puis clique sur **Émettre**.
2. Paul ouvre le menu **Finances**.

**Ce que vous devez constater** : une facture d'acompte est générée (avec une TVA de 19,25 %) ; Paul la voit dans
**Finances**, à la fois dans les appels de fonds et dans les factures (avec son PDF), et il reçoit une notification.

- [ ] **R7** — L'appel de fonds est émis et visible du client.

### Scène R8 — Paul essaie de payer en ligne

*Paul voudrait payer directement depuis son téléphone, par Mobile Money. Il clique sur **Payer**.*

> **Qui :** Paul. **Où :** espace client, menu **Finances**.

**Ce que vous faites** : cliquez sur **Payer** à côté de l'appel de fonds.

**Ce que vous devez constater**

- **Tant qu'aucun opérateur de paiement n'est configuré** (c'est le cas aujourd'hui, voir annexe A), le message suivant
  s'affiche : « Aucun moyen de paiement en ligne n'est activé. Contactez votre chargé d'affaires. » C'est le comportement
  attendu, pas une anomalie.
- Le jour où MTN MoMo ou Orange Money seront configurés : payez un petit montant réel, validez la demande sur votre
  téléphone avec votre code secret Mobile Money, attendez « Paiement confirmé », puis cliquez sur **Télécharger le reçu**.

- [ ] **R8** — Le comportement du paiement en ligne correspond à la configuration.

### Scène R8 bis — Paul paie par virement

*Paul, homme prudent, préfère le bon vieux virement bancaire. Il vire 40 % de l'appel de fonds et envoie la preuve à
Rachel. Rachel enregistre cet encaissement dans la plateforme, avec la preuve. Mais l'argent ne sera considéré comme reçu
qu'une fois qu'une autre personne, Grâce, aura vérifié la preuve et approuvé. Jusque-là, Paul ne voit rien : on ne lui
annonce pas un paiement qui n'a pas été contrôlé.*

> **Qui :** Rachel, puis Grâce, puis Paul. **Où :** ERP, *Finance › Facturation*, onglet **Appels de fonds**, puis
> *Finance › Finances*, onglet **Paiements** ; espace client, menu **Finances**.

**Ce que vous faites — la saisie, par Rachel**

1. Ouvrez l'appel de fonds de la scène R7 et cliquez sur **Enregistrer un encaissement**.
2. **Montant encaissé** : 40 % du montant de l'appel (un paiement partiel).
3. **Mode de règlement** : « Virement bancaire ». **Date de valeur** : la date d'hier.
4. **Référence** : `VIR-TEST-0002`.
5. **Preuve de l'encaissement** : joignez le PDF de preuve de virement (annexe D).
6. Cliquez sur **Enregistrer un encaissement**.

**Ce que vous devez constater après la saisie**

- Un message indique que l'encaissement est « à approuver par une autre personne ».
- La fiche de l'appel de fonds affiche **Encaissements à approuver**.
- Paul, dans son menu **Finances**, ne voit encore rien dans **Paiements et reçus**, et son **Payé** n'a pas bougé.

**Les contre-épreuves de Rachel** — vérifiez que chacune de ces saisies est **refusée** avec un message clair :

- un montant supérieur au reste à payer ;
- une date de valeur dans le futur ;
- un virement sans référence ;
- une seconde saisie avec la même référence `VIR-TEST-0002`.

**Rachel tente d'approuver sa propre saisie**

1. Rachel va dans *Finance › Finances*, onglet **Paiements**, filtre **Sens** « Encaissements » et filtre **Statut**
   « À approuver », puis ouvre l'encaissement.
2. Elle constate le bandeau **Encaissement à vérifier**, un bouton **Approuver** inactif (le double regard l'en empêche),
   et la possibilité de **Retirer la saisie**.

**Ce que vous faites — l'approbation, par Grâce**

1. Grâce ouvre le même encaissement.
2. Elle ouvre la **Preuve de l'encaissement** et contrôle le montant, la référence et la date.
3. Elle clique sur **Approuver**, puis confirme.

**Ce que vous devez constater après l'approbation**

- L'encaissement passe « Réussi », et un **Reçu** PDF est disponible (avec la date de valeur et la référence).
- L'**Historique** montre qu'il a été créé par Rachel et approuvé par Grâce.
- L'appel de fonds et sa facture passent « Partiellement payé ».
- Paul reçoit une notification (« Paiement reçu — merci »). Dans son menu **Finances**, le **Payé** correspond au montant
  encaissé, et le paiement apparaît dans **Paiements et reçus** avec un **Reçu** téléchargeable.

- [ ] **R8 bis** — L'encaissement hors ligne est saisi, contrôlé, approuvé par une seconde personne et visible du client.

### Scène R9 — Paul demande à échelonner

*La suite de l'appel de fonds pèse lourd. Paul demande à la payer en trois fois. Rachel lui propose un échéancier ; Paul
l'accepte par code.*

> **Qui :** Paul, puis Rachel, puis Paul. **Où :** espace client, **Finances** ; ERP, *Finance › Échéanciers clients*.

**Ce que vous faites**

1. Paul clique sur **Échelonner** à côté de la facture, choisit `3` échéances, explique éventuellement sa situation, puis
   clique sur **Envoyer la demande**.
2. Rachel ouvre *Finance › Échéanciers clients*, retrouve la demande et clique sur **Proposer au client** (en ajustant
   éventuellement les dates et montants, dont le total doit égaler le reste dû).
3. Paul ouvre **Mes échéanciers**, clique sur **Accepter par code**, reçoit et saisit son code, puis clique sur
   **J'accepte l'échéancier**.

**Ce que vous devez constater** : l'échéancier passe « En cours » ; les relances de la facture d'origine sont remplacées par
celles de l'échéancier.

- [ ] **R9** — L'échéancier est proposé et accepté.

### Scène R10 — Une facture, une relance, un chèque sans provision et des espèces

*Rachel émet une facture complémentaire, la valide, l'envoie et relance Paul. Paul envoie un chèque… qui n'arrive jamais
à la banque. Grâce refuse donc l'encaissement. Paul finit par régler en espèces au bureau.*

> **Qui :** Rachel, Grâce et Paul. **Où :** ERP, *Finance › Facturation*, onglet **Factures clients** ; *Finance ›
> Finances*, onglet **Paiements** ; espace client.

**Ce que vous faites — la facture**

1. Rachel clique sur **Nouvelle facture** : projet TEST, un titre, une date d'émission, une ou deux lignes. Elle enregistre.
2. Elle (ou Grâce, selon les droits) clique sur **Valider**, puis sur **Envoyer au client**.
3. Elle clique sur **Relancer le client**, puis sur **Copier un lien de paiement**, et colle ce lien dans le profil
   Visiteur.

**Ce que vous devez constater** : le PDF est numéroté ; Paul est notifié et reçoit la relance par e-mail ; le lien ouvre la
page de paiement sans qu'il soit nécessaire de se connecter.

**Ce que vous faites — le chèque refusé**

1. Rachel ouvre la facture, clique sur **Enregistrer un encaissement**, **Mode de règlement** « Chèque », référence
   `CHQ-TEST-01`, montant `1000`, une preuve. Elle enregistre.
2. Grâce ouvre l'encaissement dans *Finances › Paiements* et clique sur **Refuser**, avec le motif « Chèque non reçu à la
   banque ».

**Ce que vous devez constater** : l'encaissement passe « Annulé », avec un bandeau **Encaissement refusé** et le motif ; la
facture reste due ; Paul ne voit rien.

**Ce que vous faites — les espèces**

1. Rachel clique de nouveau sur **Enregistrer un encaissement**, mode « Espèces » (la référence est alors facultative ; le
   montant est prérempli avec le reste dû). Elle enregistre.
2. Grâce clique sur **Approuver**.

**Ce que vous devez constater** : la facture passe « Payé » et le bouton **Enregistrer un encaissement** disparaît ; Paul
voit le paiement et son **Reçu** ; la facture n'est plus payable dans son espace.

- [ ] **R10** — Facture, relance, refus d'un encaissement et solde en espèces fonctionnent.

### Scène R11 — Le geste commercial

*Pour s'excuser d'un petit retard, GLOBUS accorde à Paul un avoir.*

> **Qui :** Rachel. **Où :** une facture validée, dans *Facturation*.

**Ce que vous faites** : sur une facture validée, cliquez sur **Émettre un avoir**, indiquez un montant et un motif.

**Ce que vous devez constater** : l'avoir apparaît dans l'onglet **Avoirs**, et le reste dû diminue chez Paul.

- [ ] **R11** — L'avoir est émis et répercuté.

### Scène R12 — Les messages

*Paul a une question sur l'emplacement des prises. Il écrit à Samuel, en joignant un croquis. Samuel répond dans la
minute.*

> **Qui :** Paul, puis Samuel. **Où :** espace client, **Messagerie** ; ERP, *Communication › Messagerie*.

**Ce que vous faites**

1. Paul écrit un message au chef de projet et joint un fichier.
2. Samuel répond depuis sa messagerie.
3. Fermez l'application client sur le téléphone de Paul, puis faites écrire un nouveau message par Samuel.

**Ce que vous devez constater** : les messages arrivent en temps réel, avec les accusés de lecture, et une notification
push apparaît sur le téléphone de Paul quand l'application est fermée.

- [ ] **R12** — La messagerie client fonctionne en temps réel.

### Scène R13 — L'appel vidéo

*Plutôt que de longs messages, Samuel appelle Paul en vidéo, depuis le chantier, pour lui montrer les gaines électriques.*

> **Qui :** Samuel (sur l'ordinateur), Paul (sur le téléphone). **Où :** la conversation de la scène R12.

**Ce que vous faites**

1. Samuel lance un appel vidéo depuis la conversation.
2. Sur le téléphone de Paul, l'appel sonne : touchez **Répondre**.
3. Testez l'image et le son dans les deux sens, puis le partage d'écran depuis l'ordinateur.
4. Raccrochez, puis ouvrez *Communication › Appels*, onglet **Historique**.

**Ce que vous devez constater** : sonnerie, image, son et partage d'écran fonctionnent ; l'appel figure dans l'historique.

- [ ] **R13** — L'appel vidéo fonctionne entre ordinateur et téléphone.

### Scène R14 — La fuite sous la fenêtre

*Des mois plus tard, la maison est livrée. Un soir d'orage, Paul remarque une trace d'humidité sous la fenêtre du salon.
Il ouvre une demande de SAV. Commence alors la ronde du service après-vente : affectation, diagnostic, garantie,
intervention, validation.*

> **Qui :** Paul, Samuel (ou le Gardien), Moussa, puis Paul. **Où :** espace client, **SAV et garanties** ; ERP,
> *Commercial › SAV* ; application GLOBUS Terrain de Moussa.

**Ce que vous faites — Paul signale**

1. Paul ouvre **SAV et garanties** et clique sur **Nouvelle demande**.
2. **Objet** : `Infiltration fenêtre`. **Catégorie** : étanchéité. **Priorité** : haute. Une description précise.
3. Il clique sur **Envoyer la demande**, puis ajoute une photo dans la fiche qui s'ouvre (**Envoyer les fichiers**).

**Ce que vous faites — l'entreprise intervient**

1. Samuel ouvre le ticket dans *Commercial › SAV* et clique sur **Affecter** : Moussa.
2. Moussa, dans son application Terrain (rubrique **SAV et entretien**), réalise : **Diagnostic** (cause, gravité,
   photos), **Décision garantie** (couvert), **Planifier une intervention** (date, créneau), puis le jour venu
   **Démarrer** et **Terminer** (rapport d'intervention, une fourniture, photos avant et après).

**Ce que vous faites — Paul valide**

1. Paul clique sur **Valider l'intervention**, donne une note en étoiles et un commentaire, puis **Valider**.
2. Pour tester, il clique ensuite sur **Rouvrir** (en expliquant pourquoi), puis l'entreprise réintervient et Paul valide
   de nouveau.

**Ce que vous devez constater** : chaque étape est visible chez Paul, le délai de résolution attendu est affiché, et les
statistiques du SAV (onglet **Statistiques**) sont à jour.

- [ ] **R14** — Le circuit SAV complet fonctionne.

### Scène R15 — Le carnet d'entretien de la maison

*Une maison vit. Il faut entretenir la climatisation, vidanger la fosse, repeindre un jour. Samuel enregistre les
équipements installés ; Paul pourra demander une intervention d'un simple clic.*

> **Qui :** Samuel, puis Paul. **Où :** fiche projet, onglet **Bâtiment et maintenance** ; espace client, **Mon bâtiment**.

**Ce que vous faites**

1. Samuel clique sur **Ajouter un équipement** : catégorie climatisation, un nom, puis **Ajouter la notice** (un PDF).
2. Samuel clique sur **Passeport certifié (PDF)**.
3. Paul ouvre **Mon bâtiment**, carnet d'entretien, et clique sur **Planifier une intervention** (avec ses disponibilités),
   puis sur **Envoyer la demande**.

**Ce que vous devez constater** : un ticket SAV prérempli est créé ; le passeport certifié du bâtiment est généré avec son
QR code de vérification.

- [ ] **R15** — Le passeport du bâtiment et le carnet d'entretien fonctionnent.

### Scène R16 — Les papiers du terrain et les garanties

> **Qui :** Samuel, puis Paul. **Où :** fiche projet, onglets **Tranquillité** et **Garanties** ; espace client,
> **Dossier Tranquillité** et **Mon bâtiment**.

**Ce que vous faites**

1. Samuel, onglet **Tranquillité**, clique sur **Nouvelle pièce** : catégorie et titre `Titre foncier`, une échéance,
   cochez la visibilité client.
2. Samuel, onglet **Garanties**, clique sur **Nouvelle garantie** : type décennale, dates de début et de fin.
3. Paul ouvre **Dossier Tranquillité**, puis **Mon bâtiment**.

**Ce que vous devez constater** : Paul voit la pièce avec ses badges (par exemple « Échéance proche ») et la garantie.

- [ ] **R16** — Le dossier foncier et les garanties sont visibles du client.

### Scène R17 — Visiter sans se déplacer

*Le frère de Paul vit à l'étranger. Paul aimerait lui faire visiter le chantier. Samuel publie une visite à 360 degrés ;
Paul crée un lien de partage.*

> **Qui :** Samuel, puis Paul. **Où :** fiche projet, onglet **Immersion et digests** ; espace client, **Live, 360° et
> drone**.

**Ce que vous faites**

1. Samuel clique sur **Nouveau contenu** : type photo 360° (ou une adresse de visite en ligne), un titre, cochez **Publié
   au client**.
2. Samuel clique sur **Nouveau résumé** : la période de la semaine et un court résumé.
3. Paul ouvre **Live, 360° et drone**, sous le contenu clique sur **Partager**, puis **Créer le lien**, et **Copier**.

**Ce que vous devez constater** : le contenu s'affiche chez Paul, et le lien de partage s'ouvre dans le profil Visiteur.

- [ ] **R17** — Les contenus immersifs et leur partage fonctionnent.

### Scène R18 — Jouer avec les finitions (si une maquette configurable existe)

> **Qui :** le Gardien, puis Paul. **Où :** ERP, *Projets › Configurateur 3D* ; espace client, **Configurateur**.

**Ce que vous faites**

1. Le Gardien prépare le catalogue de matériaux et une maquette configurable, puis la publie au client.
2. Paul ouvre le **Configurateur**, choisit des finitions, crée une **Variante**, utilise **Comparer**, puis soumet son
   choix.

**Ce que vous devez constater** : les prix et délais se mettent à jour en direct, et le choix soumis arrive chez Samuel.
**Sans fichier de maquette 3D (GLB), notez cette scène « non testée ».**

- [ ] **R18** — Le configurateur fonctionne (ou scène notée « non testée »).

### Scène R19 — Une maison plus fraîche

> **Qui :** Paul, puis Samuel. **Où :** espace client, **Énergie et confort** ; fiche projet, onglet **Énergie**.

**Ce que vous faites** : Paul lance une simulation, puis clique sur **Intégrer à mon projet**.

**Ce que vous devez constater** : la demande apparaît dans l'onglet **Énergie** de la fiche projet, chez Samuel.

- [ ] **R19** — La simulation énergie remonte au chef de projet.

### Scène R20 — Le financement et le parrainage

*Deux services restent fermés tant que l'entreprise ne les a pas lancés : l'aide au financement bancaire et le programme de
parrainage. Le Gardien les ouvre le temps de l'essai.*

> **Qui :** le Gardien, puis Paul. **Où :** ERP, *Finance › Financement clients* et *Commercial › Ambassadeurs* ; espace
> client.

**Ce que vous faites**

1. Le Gardien ouvre *Finance › Financement clients* et clique sur **Ouvrir aux clients**, puis confirme avec **Ouvrir**.
2. Il ouvre *Commercial › Ambassadeurs*, clique sur **Ouvrir le programme** (confirmation **Ouvrir**), puis sur **Règles**
   pour vérifier le type et le montant de prime.
3. Paul actualise son espace : les menus **Financement** et **Parrainage** apparaissent. Il fait une simulation de
   financement, puis copie son lien d'ambassadeur.
4. Dans le profil Visiteur, ouvrez ce lien et déposez une demande sur le site.
5. Le Gardien ouvre l'onglet **Recommandations** des Ambassadeurs.
6. À la fin, si ces services ne sont pas encore lancés officiellement, le Gardien clique sur **Fermer aux clients** et
   **Fermer le programme**.

**Ce que vous devez constater** : les menus apparaissent chez Paul ; la demande déposée avec son lien est rattachée à lui
dans les recommandations.

- [ ] **R20** — Financement et parrainage s'ouvrent, fonctionnent et se referment.

### Scène R21 — L'avis de Paul

*La maison est livrée. Samuel invite Paul à donner son avis. Paul écrit quelques lignes émues et ajoute une photo de sa
villa.*

> **Qui :** Samuel, puis Paul. **Où :** fiche projet, onglet **Avis client** ; espace client, **Mon avis**.

**Ce que vous faites**

1. Samuel coche le canal **E-mail** et clique sur **Inviter le client**.
2. Paul ouvre **Mon avis**, écrit un témoignage d'au moins vingt caractères, choisit l'affichage de son nom, ajoute une
   photo et envoie.

**Ce que vous devez constater** : l'avis est reçu ; il ne sera publié sur le site qu'avec l'accord de Paul.

- [ ] **R21** — L'avis vérifié du client est collecté.

### Scène R22 — Le passeport du projet

*Paul imprime le passeport de son projet. Toute l'histoire y est : le contrat, l'avenant du marbre, les plans en vigueur,
ses décisions, ses validations signées.*

> **Qui :** Paul. **Où :** espace client, **Passeport projet**.

**Ce que vous faites** : ouvrez le Passeport projet, puis imprimez-le ou enregistrez-le en PDF.

**Ce que vous devez constater** : toutes les rubriques reprennent fidèlement ce qui s'est passé dans les scènes précédentes.

- [ ] **R22** — Le passeport projet est complet et fidèle.

## Chapitre 12 — Les chiffres de Rachel et de Grâce

*Un vendredi soir, quand le chantier s'est tu, Rachel et Grâce restent au bureau. L'une aligne les comptes, l'autre
regarde la direction que prend l'entreprise. Ce chapitre vérifie que tous les chiffres nés de l'histoire se retrouvent,
justes, dans les tableaux de bord et les rapports.*

### Scène F1 — Le tableau de bord de la directrice

> **Qui :** Grâce (profil **GLOBUS DIR**). **Où :** ERP, **Tableau de bord**.

**Ce que vous devez constater** : le chiffre d'affaires signé, le facturé, les créances, les dettes fournisseurs, la
trésorerie prévisionnelle sur six mois, les marges par chantier et les approbations en attente sont **cohérents avec tout
ce qui s'est passé** dans les chapitres précédents (le contrat de Paul, l'avenant, les paiements à Martin et à Sylvie,
les encaissements de Paul).

- [ ] **F1** — Le tableau de bord de direction est juste.

### Scène F2 — Le pilotage financier

> **Qui :** Rachel (profil **GLOBUS FIN**). **Où :** ERP, *Finance › Finances*, onglet **Pilotage**.

**Ce que vous devez constater** : la trésorerie prévisionnelle, la marge du projet TEST — Villa Mballa et les créances en
retard s'affichent et sont plausibles.

- [ ] **F2** — Le pilotage financier s'affiche correctement.

### Scène F3 — Le relevé de la banque

*Chaque mois, la banque envoie son relevé. Rachel l'importe dans la plateforme, qui retrouve toute seule les opérations
connues grâce à leurs références : le virement à Martin (« VIR-TEST-0001 ») et le virement de Paul (« VIR-TEST-0002 »).
Ce qu'elle ne reconnaît pas, Rachel le rapproche à la main.*

> **Qui :** Rachel. **Où :** *Finance › Finances*, onglet **Banque**.

**Ce que vous faites**

1. Préparez le petit fichier de relevé décrit à l'annexe B (un fichier texte enregistré avec l'extension `.csv`), en
   remplaçant les montants par ceux des scènes H14 et R8 bis.
2. Cliquez sur **Nouveau compte** : nom `TEST Banque`, type banque. Enregistrez.
3. Sur ce compte, cliquez sur **Importer et rapprocher** et déposez le fichier.
4. Pour la ligne restée non reconnue (les frais de tenue de compte), cliquez sur **Rapprocher** si un paiement correspond,
   ou laissez-la de côté.

**Ce que vous devez constater** : les lignes « VIR-TEST-0001 » et « VIR-TEST-0002 » sont rapprochées automatiquement (la
fiche de l'encaissement de Paul montre son **Rapprochement bancaire**) ; la ligne inconnue reste à rapprocher.

- [ ] **F3** — L'import et le rapprochement bancaire fonctionnent.

### Scène F4 — La petite caisse du chantier

*Sur le chantier, il faut parfois acheter un cadenas ou une rallonge, en liquide. Rachel ouvre une petite caisse confiée à
Ernest. Ernest déclare une dépense avec la photo du ticket ; Rachel la valide.*

> **Qui :** Rachel, Ernest, puis Rachel. **Où :** *Finance › Finances*, onglet **Petites caisses**.

**Ce que vous faites**

1. Rachel clique sur **Nouvelle caisse** : un nom, le projet TEST, le gestionnaire Ernest, un **Plafond** de `200000`.
2. Ernest clique sur **Déclarer un mouvement** : dépense de `15000`, un motif, la photo du justificatif.
3. Rachel ouvre le mouvement en attente et clique sur **Valider**.

**Ce que vous devez constater** : le solde de la caisse n'est débité qu'après la validation de Rachel.

- [ ] **F4** — La petite caisse fonctionne avec validation.

### Scène F5 — Une rentrée d'argent espérée

> **Qui :** Rachel. **Où :** *Finance › Finances*, onglet **Prévisions**.

**Ce que vous faites** : cliquez sur **Nouvelle prévision** : un libellé, le sens « encaissement », une **Date prévue**, un
montant, une **Probabilité** de `70` %.

**Ce que vous devez constater** : la prévision est intégrée à la trésorerie prévisionnelle (onglet **Pilotage**).

- [ ] **F5** — Les prévisions nourrissent la trésorerie.

### Scène F6 — Les créances par âge et l'export pour le comptable

> **Qui :** Rachel. **Où :** *Finance › Facturation*, onglets **Balance âgée** et **Export comptable**.

**Ce que vous faites**

1. Ouvrez la **Balance âgée** et lisez les tranches (Non échu, 1–30 j, 31–60 j…).
2. Dans **Export comptable**, choisissez le mois en cours et cliquez sur **Export comptable (CSV)**.
3. Ouvrez le fichier téléchargé avec Excel.

**Ce que vous devez constater** : les tranches sont cohérentes ; le fichier contient les écritures de ventes, d'achats et de
règlements.

- [ ] **F6** — La balance âgée et l'export comptable sont justes.

### Scène F7 — Les rapports

> **Qui :** Grâce. **Où :** ERP, **Rapports**.

**Ce que vous faites** : ouvrez la **Synthèse hebdomadaire** ; dans **Exports**, téléchargez une liste au format Excel ;
dans **Anomalies**, lancez une analyse ; dans **Prévisions**, cliquez sur **Recalculer**.

**Ce que vous devez constater** : les fichiers se téléchargent ; chaque export est tracé dans le journal d'audit (vous le
vérifierez au chapitre 17).

- [ ] **F7** — Les rapports et exports fonctionnent.

### Scène F8 — Le rapport du lundi matin

> **Qui :** Grâce. **Où :** ERP, **Rapport de direction**.

**Ce que vous faites** : cliquez sur **Générer**, puis ouvrez le PDF.

**Ce que vous devez constater** : le rapport de la semaine est produit. Sa synthèse rédigée automatiquement n'apparaît que
si l'intelligence artificielle est active (annexe A).

- [ ] **F8** — Le rapport de direction est généré.

### Scène F9 — L'argent mis sous séquestre (si un partenaire existe)

*Certains clients préfèrent que leur argent soit confié à un tiers de confiance, et libéré seulement quand chaque étape
est prouvée. Cela suppose une banque partenaire.*

> **Qui :** Grâce, puis Paul. **Où :** fiche projet, onglet **Séquestre** ; espace client, **Finances**.

**Ce que vous faites** : mettez en place la convention, placez un appel de fonds sous séquestre, demandez sa libération
avec des preuves ; Paul clique sur **Valider la libération** ; la double validation interne suit.

**Ce que vous devez constater** : les statuts se succèdent correctement. **Sans partenaire de séquestre réel, notez cette
scène « non testée ».**

- [ ] **F9** — Le séquestre fonctionne (ou scène notée « non testée »).

## Chapitre 13 — Les hommes, la sécurité et les machines

*Un chantier, ce sont d'abord des femmes et des hommes. Il faut les payer, savoir qui était là, leur accorder des congés,
les protéger. Et il y a les machines, qui tombent en panne au pire moment. Ce chapitre suit Moussa, l'ouvrier technicien,
la sécurité d'Ernest et la vieille bétonnière du chantier.*

### Scène Q1 — Le dossier de Moussa et son badge

*Rachel, qui gère aussi le personnel, crée le dossier de Moussa et imprime son badge : une carte avec un QR code, qu'il
portera autour du cou.*

> **Qui :** Rachel (profil **GLOBUS FIN**, pour son rôle Ressources humaines). **Où :** ERP, *RH et QHSE › Ressources
> humaines*, onglet **Personnel**.

**Ce que vous faites**

1. Cliquez sur **Nouvel employé** : prénom `Moussa`, nom `TEST-BELLO`, fonction (technicien), date d'embauche, métier,
   équipe « TEST Équipe gros œuvre ».
2. Dans **Compte utilisateur**, choisissez le compte de Moussa. *C'est ce lien qui lui donnera son espace RH dans
   l'application Terrain.*
3. Enregistrez, puis cliquez sur **Badge** et sur **Imprimer**.

**Ce que vous devez constater** : le badge, avec son QR code, s'imprime.

- [ ] **Q1** — Le dossier et le badge de l'employé sont créés.

### Scène Q2 — Le QR code de l'entrée du chantier

*À l'entrée du chantier, on affiche un QR code. Chaque matin, les ouvriers le scannent avec leur téléphone pour pointer
leur arrivée ; la plateforme vérifie qu'ils sont bien dans le cercle de cent cinquante mètres.*

> **Qui :** Rachel. **Où :** *Ressources humaines*, onglet **Pointage**.

**Ce que vous faites** : dans le bloc **QR d'auto-pointage du chantier**, choisissez le site « Parcelle Bonamoussadi » et
cliquez sur **Imprimer**.

**Ce que vous devez constater** : le QR code d'auto-pointage s'imprime.

- [ ] **Q2** — Le QR d'auto-pointage est imprimé.

### Scène Q3 — Les pointages

*Sept heures. Moussa arrive, scanne le QR de l'entrée : il est pointé. Ernest, lui, scanne le badge d'un ouvrier qui n'a
pas de téléphone. Et pour l'expérience, Moussa essaie de pointer depuis chez lui, loin du chantier.*

> **Qui :** Moussa (application Terrain), Ernest (application Terrain), puis Rachel. **Où :** rubrique **Pointage** de
> l'application ; ERP, onglet **Pointage**.

**Ce que vous faites**

1. Connectez l'application Terrain avec le compte de Moussa. Dans **Pointage**, scannez le QR du chantier : arrivée. Plus
   tard, scannez-le de nouveau : départ.
2. Avec le compte d'Ernest, dans **Pointage**, scannez le **badge** de Moussa imprimé à la scène Q1.
3. Essayez un pointage depuis un lieu éloigné du site (ou après avoir déplacé le site loin de vous dans la scène M3).
4. Rachel ouvre la liste des pointages et clique sur **Valider**.

**Ce que vous devez constater** : les arrivées et départs sont enregistrés ; le pointage hors périmètre est signalé au
responsable ; la validation de Rachel fonctionne.

- [ ] **Q3** — Les pointages par QR, par badge et le contrôle du périmètre fonctionnent.

### Scène Q4 — Les congés de Moussa

> **Qui :** Moussa, puis Rachel. **Où :** application Terrain, **Mon espace RH** ; ERP, onglet **Congés**.

**Ce que vous faites**

1. Moussa ouvre **Mon espace RH** et touche **Demander** : un congé de deux jours.
2. Rachel ouvre l'onglet **Congés** et clique sur **Accorder**.

**Ce que vous devez constater** : Moussa voit sa demande acceptée dans son application.

- [ ] **Q4** — Les demandes de congé circulent.

### Scène Q5 — La paie du mois

*Fin du mois. Rachel calcule la paie, ajoute une prime à Moussa pour son travail du samedi, puis la fait valider. Moussa
reçoit son bulletin dans son application.*

> **Qui :** Rachel, puis Grâce. **Où :** *Ressources humaines*, onglet **Paie** ; application Terrain de Moussa.

**Ce que vous faites**

1. Rachel clique sur **Nouvelle paie** et choisit le mois en cours : la paie se calcule.
2. Elle clique sur **Ouvrir**, puis sur **Ajuster** pour la ligne de Moussa (une prime, avec un motif), puis sur
   **Recalculer**, et ouvre le **Bulletin**.
3. Grâce (une autre personne que Rachel) clique sur **Valider (finance)**.
4. Rachel clique sur **Marquer payée** (date, mode, preuve).
5. Moussa ouvre **Mon espace RH** dans son application et ouvre son bulletin.

**Ce que vous devez constater** : la paie est figée après validation ; Moussa voit son bulletin, filigrané à son nom, et
son ouverture est enregistrée.

- [ ] **Q5** — La paie est calculée, validée, payée et consultable.

### Scène Q6 — Ce que l'on apprend d'un incident

*Le sac de ciment tombé au chapitre 10 n'a blessé personne. Mais Ernest veut comprendre pourquoi, et faire en sorte que
cela n'arrive plus. Il analyse les causes, décide d'une action, informe Paul avec transparence, puis clôt l'incident.*

> **Qui :** Ernest (pour son rôle de responsable QHSE). **Où :** ERP, *RH et QHSE › QHSE*, onglet **Incidents**.

**Ce que vous faites**

1. Ouvrez l'incident de la scène T8 et cliquez sur **Analyse des causes** (par exemple la méthode des « 5 pourquoi »).
2. Cliquez sur **Action corrective** : un titre (« Installer des garde-corps »), un responsable, une échéance.
3. Cliquez sur **Informer le client** et écrivez un message factuel.
4. Dans l'onglet **Actions correctives**, le responsable clique sur **Démarrer**, puis sur **Déclarer réalisée** (avec une
   photo comme preuve) ; l'action est vérifiée.
5. Revenez à l'incident et cliquez sur **Clôturer**.

**Ce que vous devez constater** : Paul voit l'encadré « Communiqué au client » dans son menu **Chantier** ; les indicateurs
QHSE sont à jour.

- [ ] **Q6** — Le traitement complet d'un incident de sécurité fonctionne.

### Scène Q7 — L'inspection de sécurité

> **Qui :** Ernest. **Où :** *QHSE*, onglets **Grilles** et **Inspections**.

**Ce que vous faites**

1. Onglet **Grilles** : **Nouvelle grille**, nom « TEST Sécurité », catégorie sécurité, trois points de contrôle, case
   **Actif**.
2. Onglet **Inspections** : **Nouvelle inspection** sur le projet TEST, avec cette grille. Marquez l'un des points comme
   non conforme.
3. Cliquez sur **Terminer l'inspection**.

**Ce que vous devez constater** : une action corrective s'ouvre automatiquement pour la non-conformité.

- [ ] **Q7** — Les inspections génèrent les actions correctives.

### Scène Q8 — Le casque de Moussa et le quart d'heure sécurité

> **Qui :** Ernest. **Où :** *QHSE*, onglets **EPI** et **Quarts d'heure**.

**Ce que vous faites**

1. **Nouvel EPI** : nom « Casque de chantier », type, **Durée de vie (jours)** `365`.
2. **Remettre un EPI** : le casque, à Moussa, sur le projet TEST, une quantité, la date, une signature.
3. Onglet **Quarts d'heure** : **Quart d'heure**, un thème (« Travail en hauteur »), la date, le chantier, les
   participants.

**Ce que vous devez constater** : la remise est tracée, avec sa date de renouvellement ; le quart d'heure est enregistré.

- [ ] **Q8** — La gestion des équipements de protection et des quarts d'heure fonctionne.

### Scène Q9 — La bétonnière

*La vieille bétonnière de 350 litres part sur le chantier de Paul. Chaque jour, Ernest note ses heures. Un matin, elle
tombe en panne. On la répare, puis elle rentre au dépôt.*

> **Qui :** Ernest (ou le Gardien). **Où :** ERP, *Achats et logistique › Matériel* ; application Terrain, **Matériel et
> engins**.

**Ce que vous faites**

1. Ajoutez le matériel « TEST Bétonnière 350 L ».
2. Sur sa fiche, cliquez sur **Affecter à un chantier** (projet TEST, site S1, dates).
3. Dans l'application Terrain, rubrique **Matériel et engins**, faites un relevé d'utilisation (heures).
4. Dans la fiche, créez un **Nouveau plan** de maintenance (un intervalle en jours ou en heures).
5. Cliquez sur **Déclarer un incident** : une panne, une description, une photo.
6. Créez un **Nouvel ordre** de maintenance, cliquez sur **Démarrer**, puis sur **Terminer** (coût, durée d'immobilisation,
   **Rapport**).
7. Cliquez sur **Retour au dépôt**.

**Ce que vous devez constater** : l'historique, les affectations et les coûts de la bétonnière sont à jour.

- [ ] **Q9** — Le suivi du matériel fonctionne de bout en bout.

## Chapitre 14 — La directrice en déplacement

*Grâce est à Yaoundé pour un rendez-vous à la banque. Dans le taxi, son téléphone vibre : une demande d'achat attend sa
décision. Elle valide en deux gestes, sans ouvrir d'ordinateur.*

### Scène D1 — La connexion de Grâce

> **Qui :** Grâce. **Où :** téléphone, application **GLOBUS Direction**.

**Ce que vous faites** : ouvrez GLOBUS Direction, connectez-vous avec l'e-mail, le mot de passe et le code de Grâce (la
double authentification y est obligatoire).

**Ce que vous devez constater** : le tableau de bord affiche les mêmes chiffres que sur l'ordinateur (scène F1).

- [ ] **D1** — L'application Direction s'ouvre et ses chiffres sont justes.

### Scène D2 — Valider dans le taxi

> **Qui :** Ernest (qui demande), puis Grâce (qui valide). **Où :** ERP ou Terrain ; application Direction, onglet
> **Validations**.

**Ce que vous faites**

1. Ernest crée une nouvelle demande d'achat (comme à la scène H2).
2. Sur le téléphone de Grâce, touchez la notification reçue : elle doit ouvrir directement la demande.
3. Dans **Validations**, onglet **Achats**, touchez **Approuver**.
4. Vérifiez dans l'ERP, sur l'ordinateur.

**Ce que vous devez constater** : la notification ouvre la bonne demande ; l'approbation apparaît immédiatement dans
l'ERP.

- [ ] **D2** — La validation mobile d'une demande d'achat fonctionne.

### Scène D3 — Un paiement et une situation, du bout du pouce

> **Qui :** Rachel, puis Grâce. **Où :** ERP ; application Direction.

**Ce que vous faites**

1. Rachel crée un ordre de paiement dans l'ERP (comme à la scène H12).
2. Grâce, dans **Validations**, onglet **Paiements**, touche **Approuver**.
3. Faites de même pour une situation de travaux contrôlée (onglet **Situations**).

**Ce que vous devez constater** : les statuts se mettent à jour à l'identique sur le web.

- [ ] **D3** — Les validations mobiles de paiements et de situations fonctionnent.

### Scène D4 — Gérer de loin

> **Qui :** Grâce. **Où :** application Direction, rubriques **Chantiers** et **Administration**.

**Ce que vous faites**

1. Ouvrez **Chantiers**, puis la fiche du projet TEST : budget, indice de confiance, photos, incidents.
2. Dans **Administration**, ouvrez un utilisateur de test : essayez de le **déverrouiller** (s'il l'est) ou de le
   **déconnecter partout**.

**Ce que vous devez constater** : les informations s'affichent, et les actions sont tracées dans le journal d'audit.

- [ ] **D4** — La gestion mobile fonctionne et laisse une trace.

---

# Livre VI — Autour de la maison

*La maison est debout. Restent les liens qui l'unissent au reste du monde : les messages qui circulent, la vitrine qui
attire les prochains clients, et les portes qui doivent rester fermées à ceux qui n'ont rien à y faire.*

## Chapitre 15 — Les messages qui circulent

### Scène N1 — Être prévenu même fenêtre fermée

> **Qui :** chaque personnage, à tour de rôle. **Où :** *Mon compte*, onglet **Notifications**.

**Ce que vous faites**

1. Dans chaque profil, ouvrez *Mon compte*, onglet **Notifications**, et cliquez sur **Activer le push**. Le navigateur
   demande l'autorisation : acceptez.
2. Réduisez la fenêtre, puis déclenchez une notification depuis un autre personnage (par exemple une demande de décision
   comme en R3, ou une demande d'achat comme en H2).

**Ce que vous devez constater** : une notification s'affiche dans le coin de l'écran, même fenêtre réduite.

- [ ] **N1** — Les notifications push du navigateur fonctionnent.

### Scène N2 — Choisir ce que l'on reçoit

> **Qui :** Paul. **Où :** espace client, *Mon compte*, onglet **Notifications**.

**Ce que vous faites** : décochez l'e-mail pour une catégorie de notifications, puis déclenchez un événement de cette
catégorie.

**Ce que vous devez constater** : aucun e-mail n'arrive pour cette catégorie, mais la notification reste visible sous la
cloche de l'application.

- [ ] **N2** — Les préférences de notification sont respectées.

### Scène N3 — Le registre des envois

*Quand quelqu'un dit « je n'ai jamais reçu l'e-mail », c'est ici que l'on regarde.*

> **Qui :** le Gardien. **Où :** *Administration › Paramètres*, onglet **Notifications**, sous-onglet **Journal des
> envois**.

**Ce que vous devez constater** : les e-mails envoyés au fil de l'histoire apparaissent avec le statut « envoyé », sans
échec inexpliqué. Les envois par WhatsApp ou SMS apparaissent « échoués » tant que ces canaux ne sont pas configurés
(annexe A) : c'est attendu.

- [ ] **N3** — Le journal des envois est cohérent.

### Scène N4 — La conversation d'équipe

> **Qui :** Samuel, Ernest et Moussa. **Où :** *Communication › Messagerie* (et applications mobiles).

**Ce que vous faites**

1. Samuel crée une conversation de projet avec Ernest et Moussa et y joint un fichier.
2. Ernest répond à un message précis (fonction « répondre »).
3. Samuel utilise **Rechercher dans les messages** pour retrouver un mot.

**Ce que vous devez constater** : tout fonctionne sur l'ordinateur comme dans les applications mobiles.

- [ ] **N4** — La messagerie d'équipe fonctionne.

### Scène N5 — L'aide toujours à portée de main

> **Qui :** chaque personnage. **Où :** *Aide › Documentation*, et l'icône **?** en haut de chaque écran.

**Ce que vous faites** : ouvrez la documentation, faites une recherche, puis cliquez sur le **?** depuis plusieurs écrans.

**Ce que vous devez constater** : chacun ne voit que les guides de son rôle ; la recherche fonctionne ; le **?** ouvre
l'aide de l'écran affiché.

- [ ] **N5** — La documentation intégrée est adaptée à chaque rôle.

## Chapitre 16 — La vitrine se refait une beauté

*Pendant que la Villa Mballa sortait de terre, le site continuait de vivre : des commentaires à modérer, des pages à
publier, une lettre d'information à envoyer. Le Gardien, qui fait aussi office de responsable marketing, s'en occupe.*

### Scène W1 — Le commentaire de Paul

> **Qui :** le Gardien. **Où :** *Site web › Contenus (CMS)*, onglet **Commentaires**.

**Ce que vous faites** : retrouvez le commentaire de la scène V10 et cliquez sur **Publier et répondre** (ou **Publier**),
en écrivant une petite réponse.

**Ce que vous devez constater** : le commentaire et la réponse apparaissent sous l'article, sur le site.

- [ ] **W1** — La modération des commentaires fonctionne.

### Scène W2 — Une page et un lien dans le menu

> **Qui :** le Gardien. **Où :** *Site web › Contenus (CMS)*, onglets **Pages** et **Navigation**.

**Ce que vous faites**

1. Onglet **Pages**, **Nouvelle page** : titre `TEST Page recette` (l'adresse se remplit toute seule), une section, un bloc
   de texte. Cliquez sur **Enregistrer**, puis sur **Publier directement**.
2. Onglet **Navigation**, menu « Pied de page — principal » : cliquez sur **Élément**, choisissez cette page, puis cliquez
   sur **Publier le menu**.
3. Ouvrez le site dans le profil Visiteur et cherchez le lien en bas de page.
4. Ensuite, retirez le lien du menu (publiez de nouveau le menu), archivez la page, puis supprimez-la.

**Ce que vous devez constater** : la page et le lien apparaissent sur le site en quelques secondes, puis disparaissent
proprement.

- [ ] **W2** — La création, la publication et le retrait d'une page fonctionnent.

### Scène W3 — Un article de blog

> **Qui :** le Gardien. **Où :** *CMS*, onglet **Collections**, **Articles**.

**Ce que vous faites** : cliquez sur **Nouveau — Articles** (un titre, un contenu), soumettez-le, publiez-le, vérifiez-le
sur le site, puis archivez-le.

**Ce que vous devez constater** : le circuit brouillon, publié, archivé est respecté.

- [ ] **W3** — Le circuit de publication d'un article fonctionne.

### Scène W4 — Le référencement et les redirections

> **Qui :** le Gardien. **Où :** *Site web › SEO*.

**Ce que vous faites**

1. Dans l'onglet **Audit et métadonnées**, cliquez sur **Optimiser** pour une page, puis sur **Enregistrer**.
2. Onglet **Redirections** : **Nouvelle redirection** de `/test-ancienne` vers `/`.
3. Dans le profil Visiteur, tapez l'adresse `https://globus-engineering-sarl.com/test-ancienne` : vous devez arriver sur
   l'accueil.
4. Supprimez ensuite la redirection.
5. Ouvrez `https://globus-engineering-sarl.com/sitemap.xml` et `https://globus-engineering-sarl.com/robots.txt`.

**Ce que vous devez constater** : la redirection fonctionne ; les deux fichiers publics s'ouvrent.

- [ ] **W4** — Le SEO et les redirections fonctionnent.

### Scène W5 — La lettre d'information

> **Qui :** le Gardien. **Où :** *Commercial › Newsletter*.

**Ce que vous faites**

1. Onglet **Abonnés** : vérifiez que l'abonnée de la scène V8 est « confirmée ».
2. Onglet **Segments** : **Nouveau segment** (par exemple les abonnés portant un tag TEST, que vous ajoutez à l'abonnée).
3. Onglet **Modèles** : **Nouveau modèle** (un objet, un contenu).
4. Onglet **Campagnes** : **Nouvelle campagne** vers ce segment, puis **Envoyer maintenant**.

**Ce que vous devez constater** : l'e-mail arrive sur l'adresse `+news`, avec un lien de désinscription qui fonctionne.

- [ ] **W5** — L'envoi d'une campagne fonctionne.

### Scène W6 — Les visiteurs ont laissé des traces

> **Qui :** le Gardien. **Où :** *Site web › Analytics*.

**Ce que vous devez constater** : les visites et les conversions du chapitre 4 (« Décrire mon projet », contact,
newsletter) apparaissent, à condition qu'au moins une visite ait accepté la mesure d'audience dans le bandeau des cookies.

- [ ] **W6** — Les statistiques reflètent les visites.

### Scène W7 — La médiathèque

> **Qui :** le Gardien. **Où :** *Site web › Médiathèque*.

**Ce que vous faites**

1. Cliquez sur **Envoyer des fichiers** et déposez une image ; renseignez son texte alternatif.
2. Ouvrez une image déjà utilisée par une page du site et essayez de l'**Archiver**.

**Ce que vous devez constater** : l'archivage de l'image utilisée est refusé, avec la liste des pages qui l'utilisent.

- [ ] **W7** — La médiathèque protège les images utilisées.

## Chapitre 17 — Les portes qui doivent rester fermées

*Jusqu'ici, on a vérifié que chacun pouvait faire son travail. Il faut maintenant vérifier l'inverse : que personne ne
peut faire ce qui ne le regarde pas. Un bon immeuble n'est pas seulement un immeuble dont les portes s'ouvrent ; c'est
aussi un immeuble dont les mauvaises portes restent fermées.*

### Scène X1 — Moussa ne voit pas les comptes

> **Qui :** Moussa (profil **GLOBUS TEC**). **Où :** ERP.

**Ce que vous faites**

1. Regardez le menu de gauche de Moussa.
2. Dans la barre d'adresse, tapez `https://globus-engineering-sarl.com/erp/finances` et appuyez sur **Entrée**.

**Ce que vous devez constater** : aucun menu Finance, CRM ou Administration ; l'adresse tapée à la main est refusée.

- [ ] **X1** — Les menus et pages sont cloisonnés selon le rôle.

### Scène X2 — Paul reste chez lui

> **Qui :** Paul (profil **GLOBUS CLI**). **Où :** barre d'adresse.

**Ce que vous faites** : tapez `https://globus-engineering-sarl.com/erp` et appuyez sur **Entrée**. Puis parcourez de
nouveau son espace.

**Ce que vous devez constater** : l'accès à l'ERP est refusé ; l'espace client ne montre aucune donnée interne (prix
d'achat, notes internes de l'équipe, autres projets).

- [ ] **X2** — Le client est cloisonné.

### Scène X3 — Chacun son extranet

> **Qui :** Martin (profil **GLOBUS FOU**), puis Sylvie (profil **GLOBUS STT**). **Où :** extranet.

**Ce que vous devez constater** : Martin ne voit ni les consultations de sous-traitance ni les autres fournisseurs ; Sylvie
ne voit pas les commandes de fournitures.

- [ ] **X3** — Les partenaires sont cloisonnés.

### Scène X4 — Personne ne s'approuve soi-même

**Ce que vous devez constater** : comme on l'a vu aux scènes H3, H13 et R8 bis, aucun personnage ne peut approuver ce qu'il
a lui-même créé (demande d'achat, paiement, encaissement). Cochez si ces trois scènes étaient conformes.

- [ ] **X4** — La séparation des tâches est respectée partout.

### Scène X5 — Le cambrioleur maladroit

*Un inconnu essaie de deviner le mot de passe de Moussa. Au bout de cinq essais, la porte se verrouille.*

> **Qui :** un visiteur malveillant (profil **Visiteur**), puis le Gardien. **Où :** page de connexion ; ERP,
> *Administration › Sécurité* et *Utilisateurs et rôles*.

**Ce que vous faites**

1. Sur la page de connexion, tapez l'adresse de Moussa et un mauvais mot de passe, **cinq fois de suite**.
2. Le Gardien ouvre *Administration › Sécurité*, onglet **Synthèse**.
3. Le Gardien ouvre la fiche de Moussa dans *Utilisateurs et rôles* et clique sur **Déverrouiller**.

**Ce que vous devez constater** : le compte de Moussa est verrouillé temporairement ; il apparaît dans les comptes
verrouillés de la synthèse de sécurité ; le déverrouillage le libère.

- [ ] **X5** — Le verrouillage après plusieurs échecs fonctionne.

### Scène X6 — Moussa a oublié son mot de passe

> **Qui :** Moussa. **Où :** page de connexion.

**Ce que vous faites**

1. Cliquez sur **Mot de passe oublié ?**, tapez l'adresse de Moussa, puis **Envoyer le lien**.
2. Ouvrez l'e-mail reçu (le lien est valable une heure), choisissez un nouveau mot de passe et **Enregistrer**.
3. Essayez de vous connecter avec l'ancien mot de passe, puis avec le nouveau.

**Ce que vous devez constater** : l'ancien mot de passe est refusé, le nouveau accepté.

- [ ] **X6** — La réinitialisation du mot de passe fonctionne.

### Scène X7 — Le téléphone oublié dans un taxi

*Ernest a oublié son téléphone dans un taxi. Depuis l'ordinateur du bureau, il ferme toutes ses autres sessions.*

> **Qui :** Ernest. **Où :** *Mon compte*, onglet **Sessions et appareils**.

**Ce que vous faites** : cliquez sur **Fermer les autres sessions** et confirmez.

**Ce que vous devez constater** : l'application Terrain du téléphone d'Ernest est déconnectée.

- [ ] **X7** — La fermeture des sessions à distance fonctionne.

### Scène X8 — La seconde serrure à refaire

*Ernest a un nouveau téléphone : son application d'authentification est vide. Le Gardien réinitialise sa double
authentification, après avoir vérifié que c'est bien lui.*

> **Qui :** le Gardien, puis Ernest. **Où :** *Utilisateurs et rôles*, fiche d'Ernest.

**Ce que vous faites** : cliquez sur **Réinitialiser la MFA** et confirmez avec votre propre code. Ernest se reconnecte.

**Ce que vous devez constater** : Ernest doit reconfigurer sa double authentification à sa connexion suivante.

- [ ] **X8** — La réinitialisation de la double authentification fonctionne.

### Scène X9 — Les clés les plus précieuses

*Certaines opérations sont si sensibles (les secrets des services extérieurs, par exemple) que la plateforme redemande le
code de double authentification, même à l'administrateur.*

> **Qui :** le Gardien. **Où :** *Administration › Paramètres*, onglet **Intégrations**.

**Ce que vous faites** : cliquez sur **Régler** à côté d'un secret quelconque, puis annulez sans rien enregistrer.

**Ce que vous devez constater** : si votre session n'est pas encore confirmée, la fenêtre **Confirmer avec votre double
authentification** apparaît.

- [ ] **X9** — Les opérations sensibles exigent une confirmation.

### Scène X10 — Fermé pour travaux

*Un jour, il faudra peut-être fermer la plateforme quelques minutes pour une opération de maintenance. On essaie.*

> **Qui :** le Gardien, puis Paul. **Où :** *Administration › Paramètres*, onglet **Maintenance**.

**Ce que vous faites**

1. **Message affiché aux utilisateurs** : `Test de maintenance`. **Fin prévue** : dans 15 minutes.
2. Cliquez sur **Activer** et confirmez.
3. Dans la fenêtre de Paul, actualisez la page.
4. Revenez chez le Gardien et cliquez sur **Terminer la maintenance**.

**Ce que vous devez constater** : pendant la maintenance, Paul voit le message et seuls les administrateurs accèdent à la
plateforme ; ensuite, tout revient à la normale.

- [ ] **X10** — Le mode maintenance fonctionne.

### Scène X11 — Le grand registre

*Tout ce qui s'est passé dans cette histoire a été écrit dans un registre infalsifiable : chaque ligne est liée à la
précédente par un calcul cryptographique, si bien qu'on ne peut en modifier aucune sans que cela se voie.*

> **Qui :** le Gardien. **Où :** *Administration › Journal d'audit*.

**Ce que vous faites** : recherchez les actions liées au projet TEST, ouvrez-en quelques-unes, puis lancez la vérification
d'intégrité.

**Ce que vous devez constater** : les actions des chapitres précédents sont toutes là ; le message « Chaîne d'audit
intègre » s'affiche.

- [ ] **X11** — Le journal d'audit est complet et intègre.

### Scène X12 — La clé qu'on reprend

> **Qui :** le Gardien. **Où :** *Utilisateurs et rôles*.

**Ce que vous faites**

1. Ouvrez un compte de test (par exemple celui de Linda) et cliquez sur **Désactiver le compte**.
2. Essayez de vous connecter avec ce compte.
3. Réactivez-le.

**Ce que vous devez constater** : la connexion est refusée tant que le compte est désactivé ; elle redevient possible après
la réactivation.

- [ ] **X12** — La désactivation et la réactivation d'un compte fonctionnent.

---

# Épilogue

## Chapitre 18 — Le bilan

*La Villa Mballa n'existe pas, et pourtant vous l'avez construite de bout en bout. Il est temps de faire le bilan, de
ranger le chantier et de signer le procès-verbal.*

### Scène Z1 — Compter

**Ce que vous faites**

1. Reportez le résultat de chaque scène dans le tableau récapitulatif de l'annexe E : **OK**, **KO** (anomalie) ou **NT**
   (non testé, avec la raison).
2. Classez les anomalies par gravité :
   - **bloquante** : on ne peut pas continuer l'histoire ;
   - **majeure** : le résultat est faux ou une règle importante n'est pas respectée ;
   - **mineure** : gênant, mais on peut faire autrement ;
   - **cosmétique** : une faute de frappe, un alignement.

**Le critère conseillé pour livrer** : **aucune anomalie bloquante ni majeure** dans les chapitres 3 à 11 et 17.

- [ ] **Z1** — Le bilan est fait.

### Scène Z2 — Ranger le chantier (premier chemin : garder les traces)

**Ce que vous faites**

1. Fiche du projet « TEST — Villa Mballa » : cliquez sur **Archiver** et confirmez.
2. Dans *Utilisateurs et rôles*, désactivez les dix comptes de test (**Désactiver le compte**).
3. Fiches du fournisseur et du sous-traitant TEST : **Changer le statut** (ou **Statut**) vers « suspendu ».
4. Si le financement et le parrainage ne sont pas encore lancés officiellement, vérifiez qu'ils sont refermés (scène R20).
5. Supprimez la page et l'article de test (scènes W2 et W3) s'ils existent encore.

- [ ] **Z2** — Le chantier d'essai est rangé (ou je suis le second chemin).

### Scène Z3 — Effacer le tableau (second chemin : la remise à zéro)

*Si vous avez choisi le second chemin au tout début, c'est le moment de faire place nette, sans toucher au site.*

**Ce que vous faites**

1. *Administration › Paramètres*, bouton **Système et sauvegardes**, carte **Remise à zéro des données
   d'exploitation** : cliquez sur **Préparer la remise à zéro**.
2. Lisez les deux colonnes **Sera supprimé** et **Sera conservé**.
3. **E-mail du nouvel administrateur** : l'adresse de l'entreprise (par exemple `contact@globus-engineering-sarl.com`).
4. Écrivez une justification d'au moins vingt caractères, tapez votre code de double authentification, puis la phrase
   `REMETTRE A ZERO` en majuscules, et cliquez sur **Remettre à zéro**.
5. Cliquez sur **Aller à la connexion** : votre compte a été supprimé avec les autres.
6. Ouvrez la boîte de l'adresse choisie, cliquez sur le lien d'invitation et activez le nouvel administrateur (mot de
   passe, puis double authentification).

**Ce que vous devez constater** : le site vitrine est intact (pages, menus, images, réglages) ; dans l'ERP, il n'y a plus
qu'un seul compte, aucun projet ni client ; les intégrations restent configurées ; *Paramètres › Système et
sauvegardes* montre la « Sauvegarde de sécurité (avant opération irréversible) » faite juste avant. Les e-mails envoyés
pendant l'essai, eux, ne peuvent évidemment pas être rappelés.

- [ ] **Z3** — La remise à zéro a laissé le site intact et une base propre (ou je suis le premier chemin).

### Scène Z4 — Le procès-verbal

**Ce que vous faites** : rédigez une page qui indique la date, les personnes présentes, la version testée (affichée sur la
page **Système**), le résultat global, les réserves éventuelles et la date prévue pour les lever. Signez-la.

- [ ] **Z4** — Le procès-verbal de recette est signé.

*Et ainsi s'achève l'histoire de la Villa Mballa. Quelque part à Douala, un vrai Paul attend déjà de cliquer sur
« Décrire mon projet ». Cette fois, la maison sera prête à l'accueillir.*

---

# Annexes

## Annexe A — Ce qui ne peut pas encore être testé (au 20 octobre 2026)

*Certaines fonctions dépendent de services extérieurs qui ne sont pas encore branchés. Pendant l'essai, leur absence est
normale : notez la scène « non testée » plutôt qu'en anomalie.*

| Fonction | Où en est-on | Ce que cela change pendant l'essai |
| --- | --- | --- |
| **Paiement en ligne** (MTN MoMo, Orange Money, carte bancaire) | Pas encore configuré : il faut signer les contrats avec les opérateurs puis saisir leurs clés dans *Intégrations*. | À la scène R8, le message « Aucun moyen de paiement en ligne n'est activé » est attendu. |
| **Encaissement hors ligne** (virement, chèque, espèces, dépôt Mobile Money direct) | **Disponible** : bouton **Enregistrer un encaissement** sur les appels de fonds et les factures, avec preuve, approuvé par une autre personne dans *Finances › Paiements*. | C'est la façon de faire passer les pièces « Payé » tant que le paiement en ligne n'existe pas : scènes R8 bis et R10. |
| **WhatsApp** et **SMS** | Pas encore configurés. | Choisissez toujours l'**e-mail** pour recevoir les codes ; les envois WhatsApp ou SMS apparaissent « échoués » dans le journal (scène N3). |
| **Intelligence artificielle (Claude)** | La clé actuelle est refusée ; il faut la renouveler dans *Intégrations*. | Estimation instantanée, lecture de documents, synthèses et assistant en mode IA fonctionnent en mode réduit (l'assistant répond par règles). |
| **Google Maps** | Clé à saisir. | Les cartes du site et les positions sur carte ne s'affichent pas. |
| **iPhone** | Les applications ne sont pas signées pour Apple (il faut un compte Apple Developer). | Testez les applications mobiles sur Android uniquement. |
| **Séquestre et financement bancaire** | Nécessitent une banque partenaire réelle. | La scène F9 et la transmission du dossier de financement (R20) sont « non testées ». |

## Annexe B — Les données de l'histoire

- **Le client** : Paul TEST-MBALLA, `votre.adresse+client@gmail.com`, Douala, univers HOME, villa de 180 m² à un étage,
  budget de 20 à 30 millions de francs CFA.
- **Le devis** : Études et plans 3 000 000 ; Gros œuvre 15 000 000 ; Second œuvre 7 000 000 ; TVA 19,25 % ; échéancier
  30 % / 40 % / 30 %.
- **Le fournisseur** : TEST Quincaillerie du Wouri — Ciment CPJ 42.5 en sac de 50 kg, à 5 200 francs (contre-offre à
  5 000).
- **Le sous-traitant** : TEST Électricité Akwa — tableau électrique à 350 000 francs (×1), points lumineux à 25 000 francs
  (×30).

**Le relevé bancaire de la scène F3.** Ouvrez le Bloc-notes de Windows, copiez-y les quatre lignes ci-dessous, puis
remplacez les montants par les vôtres : celui du paiement exécuté en H14 (négatif, c'est une sortie d'argent) et celui de
l'encaissement approuvé en R8 bis (positif, c'est une entrée). Enregistrez le fichier sous le nom `releve-test.csv` (dans
la fenêtre d'enregistrement, choisissez le type « Tous les fichiers » et l'encodage « UTF-8 »).

```
date;libellé;référence;montant
20/10/2026;VIR TEST QUINCAILLERIE;VIR-TEST-0001;-508760
20/10/2026;VIR RECU TEST-MBALLA;VIR-TEST-0002;3000000
21/10/2026;FRAIS TENUE DE COMPTE;;-2500
```

Les références « VIR-TEST-0001 » et « VIR-TEST-0002 » sont celles saisies aux scènes H14 et R8 bis : ce sont elles qui
permettent à la plateforme de retrouver toute seule les opérations.

## Annexe C — La fiche d'anomalie

*Recopiez cette fiche pour chaque problème rencontré. Plus elle est précise, plus la correction sera rapide.*

```
Code de la scène   : (par exemple H11)
Personnage et appareil : (par exemple Rachel — Chrome sur Windows ; Ernest — téléphone Android, application Terrain)
Date et heure      :
Ce que j'ai fait   :
Ce que j'attendais :
Ce qui s'est passé : (le message exact affiché, et une capture d'écran)
Gravité            : bloquante / majeure / mineure / cosmétique
```

Si un message affiche « Erreur interne. Référence : … », recopiez cette **référence** : elle permet de retrouver le
problème dans les journaux du serveur.

> Pour faire une capture d'écran sous Windows : appuyez en même temps sur les touches **Windows**, **Majuscule** et **S**,
> puis sélectionnez la zone. Sur Android : appuyez en même temps sur **Marche/Arrêt** et **Volume bas**.

## Annexe D — Les fichiers à préparer

- Deux PDF quelconques, renommés « Plan RDC » et « Plan RDC v2 », et un PDF « Contrat signé ».
- Un PDF « Facture fournisseur », un PDF « Facture sous-traitant », un PDF « Preuve de virement ».
- Un PDF « Mémoire technique » et un PDF « Attestation fiscale ».
- Six photos de chantier prises avec le téléphone, localisation activée.
- Facultatif : une maquette numérique IFC ou RVT (Hub BIM), un fichier 3D GLB (configurateur), une photo à 360 degrés.

## Annexe E — Le tableau de bord de la recette

*Reportez ici le résultat de chaque scène : **OK**, **KO** ou **NT** (non testé).*

| Code | Scène | Résultat |
| --- | --- | --- |
| P1 | Les voyants des intégrations | |
| P2 | La santé du système | |
| P3 | La sauvegarde complète | |
| P4 | Le test de restauration | |
| A1 | Connexion du Gardien | |
| A2 | Le trousseau des rôles | |
| A3 | Organisation fournisseur | |
| A4 | Organisation sous-traitant | |
| A5 | Fiche fournisseur reliée | |
| A6 | Produit au catalogue | |
| A7 | Fiche sous-traitant reliée | |
| A8 | Création de l'équipe | |
| A9 | Invitation des sept collègues | |
| A10 | Invitation des partenaires | |
| A11 | Invitation révoquée puis renvoyée | |
| A12 | Activation des neuf comptes | |
| A13 | L'équipe complète | |
| V1 | Bandeau des cookies | |
| V2 | Navigation sur le site | |
| V3 | Recherche | |
| V4 | Contenus du site | |
| V5 | Décrire mon projet | |
| V6 | Estimation instantanée | |
| V7 | Formulaire de contact | |
| V8 | Abonnement à la newsletter | |
| V9 | Assistant du site | |
| V10 | Commentaire de blog | |
| V11 | Pages légales | |
| C1 | Règle d'affectation | |
| C2 | Arrivée des prospects | |
| C3 | Dossier du prospect | |
| C4 | Première activité | |
| C5 | Qualification | |
| C6 | Conversion en opportunité | |
| C7 | Pipeline | |
| C8 | Devis | |
| C9 | Envoi du devis | |
| C10 | Acceptation du devis par code | |
| C11 | Révision et refus | |
| C12 | Contrat | |
| C13 | Signature du contrat | |
| C14 | Création du projet et invitation du client | |
| C15 | Relance | |
| C16 | Conversation de l'assistant | |
| K1 | Activation du client | |
| K2 | Double authentification du client | |
| K3 | Déconnexion et reconnexion | |
| K4 | Tableau de bord du client | |
| K5 | Pages de l'espace client | |
| K6 | Application GLOBUS Client | |
| M1 | Fiche du projet | |
| M2 | Équipe du projet | |
| M3 | Site et géorepérage | |
| M4 | Lots et phases | |
| M5 | Jalons | |
| M6 | Planning et référence | |
| M7 | Planning intelligent | |
| M8 | Budget de référence | |
| M9 | Circuit d'un plan dans la GED | |
| M10 | Plan publié au client | |
| M11 | Maquette 3D | |
| M12 | QR code de zone | |
| M13 | Agenda | |
| M14 | Registre des risques | |
| M15 | Panneau connecté | |
| H1 | Dépôt et article | |
| H2 | Demande d'achat | |
| H3 | Approbation | |
| H4 | Bon de commande | |
| H5 | Envoi au fournisseur | |
| H6 | Contre-offre et confirmation | |
| H7 | Annonce d'expédition | |
| H8 | Réception sur le chantier | |
| H9 | Mouvements de stock | |
| H10 | Facture fournisseur | |
| H11 | Rapprochement des trois pièces | |
| H12 | Ordre de paiement | |
| H13 | Double regard | |
| H14 | Exécution du paiement | |
| H15 | Notation et clôture | |
| H16 | Documents légaux du fournisseur | |
| S1 | Qualification du sous-traitant | |
| S2 | Consultation | |
| S3 | Offre scellée | |
| S4 | Clôture et attribution | |
| S5 | Signature du marché | |
| S6 | Mobilisation | |
| S7 | Situation de travaux | |
| S8 | Constat terrain | |
| S9 | Validation de la situation | |
| S10 | Facture et paiement du sous-traitant | |
| S11 | Réclamation | |
| S12 | Litige | |
| S13 | Dépassement de marché | |
| T1 | Connexion à l'application Terrain | |
| T2 | Avancement d'une tâche | |
| T3 | Journal de chantier | |
| T4 | Photos | |
| T5 | Rapport vocal | |
| T6 | Scan d'une zone | |
| T7 | Plan périmé | |
| T8 | Incident de sécurité | |
| T9 | Mode hors ligne | |
| T10 | Conflit de synchronisation | |
| T11 | Sortie de stock | |
| T12 | Lecture de documents | |
| R1 | Photos publiées au client | |
| R2 | Certification des photos | |
| R3 | Demande de décision | |
| R4 | Décision validée par code | |
| R5 | Décision refusée | |
| R6 | Avenant | |
| R7 | Appel de fonds | |
| R8 | Paiement en ligne | |
| R8 bis | Encaissement hors ligne | |
| R9 | Échéancier | |
| R10 | Facture, relance, chèque refusé, espèces | |
| R11 | Avoir | |
| R12 | Messagerie | |
| R13 | Appel vidéo | |
| R14 | SAV complet | |
| R15 | Bâtiment et carnet d'entretien | |
| R16 | Dossier foncier et garanties | |
| R17 | Contenus immersifs | |
| R18 | Configurateur | |
| R19 | Énergie | |
| R20 | Financement et parrainage | |
| R21 | Avis client | |
| R22 | Passeport projet | |
| F1 | Tableau de bord de direction | |
| F2 | Pilotage financier | |
| F3 | Rapprochement bancaire | |
| F4 | Petite caisse | |
| F5 | Prévisions | |
| F6 | Balance âgée et export comptable | |
| F7 | Rapports et exports | |
| F8 | Rapport de direction | |
| F9 | Séquestre | |
| Q1 | Dossier et badge de l'employé | |
| Q2 | QR d'auto-pointage | |
| Q3 | Pointages | |
| Q4 | Congés | |
| Q5 | Paie | |
| Q6 | Traitement d'un incident | |
| Q7 | Inspection | |
| Q8 | Équipements de protection et quart d'heure | |
| Q9 | Matériel | |
| D1 | Connexion à l'application Direction | |
| D2 | Validation d'un achat en mobilité | |
| D3 | Validation d'un paiement et d'une situation | |
| D4 | Gestion à distance | |
| N1 | Notifications push | |
| N2 | Préférences de notification | |
| N3 | Journal des envois | |
| N4 | Messagerie d'équipe | |
| N5 | Documentation intégrée | |
| W1 | Modération d'un commentaire | |
| W2 | Page et menu | |
| W3 | Article de blog | |
| W4 | SEO et redirections | |
| W5 | Campagne de newsletter | |
| W6 | Statistiques | |
| W7 | Médiathèque | |
| X1 | Cloisonnement par rôle | |
| X2 | Cloisonnement du client | |
| X3 | Cloisonnement des partenaires | |
| X4 | Séparation des tâches | |
| X5 | Verrouillage | |
| X6 | Mot de passe oublié | |
| X7 | Fermeture des sessions | |
| X8 | Réinitialisation de la double authentification | |
| X9 | Opérations sensibles | |
| X10 | Mode maintenance | |
| X11 | Journal d'audit | |
| X12 | Désactivation d'un compte | |
| Z1 | Bilan | |
| Z2 | Rangement (premier chemin) | |
| Z3 | Remise à zéro (second chemin) | |
| Z4 | Procès-verbal | |

## Annexe F — Que faire si…

**… un e-mail n'arrive pas ?**
Patientez deux ou trois minutes. Regardez dans le dossier **Spam** et dans l'onglet **Promotions** de Gmail. Vérifiez que
l'adresse « + » a été tapée sans faute. Enfin, le Gardien peut consulter le **Journal des envois** (scène N3) : si
l'e-mail y figure « échoué », notez une anomalie.

**… le code à 6 chiffres est refusé ?**
Vérifiez que vous lisez la bonne ligne dans l'application d'authentification (celle du bon personnage). Attendez le code
suivant (il change toutes les 30 secondes). Si cela persiste, vérifiez que l'heure de votre téléphone est réglée en
automatique (*Paramètres › Date et heure › Réglage automatique*).

**… le lien d'invitation a expiré ?**
Les liens d'invitation restent valables sept jours. Passé ce délai, le Gardien envoie un nouveau lien : dans
*Administration › Utilisateurs et rôles*, ouvrez la fiche de la personne (statut **Invité**) et cliquez sur **Renvoyer
l'invitation**, ou, dans l'onglet **Invitations**, cliquez sur **Renvoyer** sur la ligne de son adresse. Pour Paul, qui a été
invité automatiquement à la création de son projet, passez par l'onglet **Invitations** : il n'a pas encore de fiche dans
l'onglet Utilisateurs.

**… je suis déconnecté sans arrêt en changeant de personnage ?**
Vous utilisez sans doute le même profil de navigateur pour deux personnages. Reprenez la section 1.3 : un profil par
personnage.

**… une page reste blanche ou affiche une erreur ?**
Actualisez la page (touche **F5**). Si l'erreur persiste, faites une capture d'écran, notez la **référence** affichée et
remplissez une fiche d'anomalie.

**… un bouton décrit dans ce livre n'apparaît pas ?**
Vérifiez d'abord que vous êtes bien connecté avec le bon personnage : beaucoup de boutons n'apparaissent qu'aux rôles
autorisés (c'est voulu). Vérifiez ensuite que le dossier est dans le bon statut (par exemple, le bouton **Valider** d'une
facture n'existe que tant qu'elle est en brouillon). Si tout est correct, notez une anomalie.

**… l'application Terrain n'envoie pas mes saisies ?**
Vérifiez que le mode avion est bien coupé, puis tirez l'écran d'accueil vers le bas pour forcer l'envoi. Ne vous
déconnectez jamais avant que tout soit envoyé : les saisies non envoyées sont effacées à la déconnexion.

**… le pointage est refusé alors que je suis sur place ?**
Vérifiez que la localisation du téléphone est activée et autorisée pour GLOBUS Terrain, et que les coordonnées du site
(scène M3) correspondent bien à l'endroit où vous vous trouvez.
