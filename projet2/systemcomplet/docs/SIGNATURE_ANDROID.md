# Applications Android : clé de signature permanente et numéro de version

**En bref** : un téléphone Android n'accepte de **mettre à jour** une application que si la nouvelle version est signée
avec la **même clé** que la version installée. Cette page explique comment créer cette clé **une seule fois**, la garder
en sécurité et la confier à GitHub, qui fabrique les trois applications (GLOBUS Client, GLOBUS Terrain, GLOBUS
Direction). Comptez une vingtaine de minutes. Personne d'autre que vous ne manipule cette clé.

## Pourquoi

- **Sans clé permanente (situation actuelle)** : chaque fabrication est signée avec une clé jetable, différente à chaque
  fois. Le téléphone refuse la mise à jour (« Application non installée », « conflit avec un package existant ») : il
  faut désinstaller l'application, ce qui efface ce qu'elle gardait sur le téléphone (saisies hors ligne pas encore
  envoyées, connexion).
- **Avec la clé permanente** : on ouvre le nouveau fichier `.apk`, on touche **Mettre à jour**, et tout est conservé.

Chaque fabrication reçoit aussi un **numéro de version** qui augmente (`1.0.312`, puis `1.0.313`…) : voir
[Le numéro de version](#le-numéro-de-version).

## Ce qu'il vous faut

- L'ordinateur de travail (Windows) avec Java, qui fournit la commande `keytool`. Pour vérifier : ouvrez **PowerShell**
  (menu Démarrer, tapez « PowerShell »), tapez `keytool -help` puis Entrée : une liste d'options s'affiche. Si Windows
  répond que la commande est introuvable, remplacez `keytool` par son chemin complet dans les commandes ci-dessous, par
  exemple `& "C:\Program Files\Java\jdk-23\bin\keytool.exe"`.
- Un accès administrateur au dépôt GitHub `Borislegangster/fullstackproject`.
- Une clé USB et votre coffre-fort de mots de passe (ou, à défaut, un carnet rangé sous clé).

## Étape 1 — Choisir le mot de passe

Choisissez un mot de passe d'au moins 12 caractères, de préférence uniquement des lettres et des chiffres (les espaces et
les accents fonctionnent, mais compliquent la saisie). Notez-le dans votre coffre-fort de mots de passe **avant** de
continuer. Ce même mot de passe protège le fichier de clé et la clé elle-même.

## Étape 2 — Créer la clé (une seule fois)

Dans PowerShell, collez cette commande (une seule ligne), puis Entrée :

```powershell
keytool -genkeypair -v -keystore "$HOME\Documents\globus-android.jks" -storetype PKCS12 -alias globus -keyalg RSA -keysize 4096 -validity 10000
```

`keytool` pose ensuite quelques questions :

1. **Mot de passe du fichier de clés** : tapez le mot de passe de l'étape 1 (rien ne s'affiche à l'écran, c'est normal),
   Entrée, puis une seconde fois pour confirmer.
2. **Nom et prénom** : `GLOBUS ENGINEERING SARL`.
3. **Unité organisationnelle** : `Applications mobiles`.
4. **Organisation** : `GLOBUS ENGINEERING SARL`.
5. **Ville**, puis **État ou province** : ceux du siège.
6. **Code pays à deux lettres** : `CM`.
7. **Est-ce correct ?** : tapez `oui` (ou `yes` si les questions sont en anglais), puis Entrée.

Le fichier `globus-android.jks` se trouve maintenant dans votre dossier **Documents**. La clé est valable 27 ans.

## Étape 3 — Mettre la clé en lieu sûr (le plus important)

- Copiez `globus-android.jks` à **deux** endroits : une clé USB rangée au coffre du bureau, et un second support gardé
  ailleurs (coffre-fort de mots de passe qui accepte les pièces jointes, ou disque externe chez le dirigeant).
- Gardez le mot de passe **à part** du fichier.
- Ne l'envoyez jamais par e-mail ni WhatsApp, et ne le déposez jamais dans le dossier du projet : le dépôt GitHub est
  **public**. Le seul endroit en ligne où la clé a sa place, ce sont les secrets de l'étape 4.

> [!WARNING]
> **Clé ou mot de passe perdu** : plus aucune mise à jour n'est possible pour les applications déjà installées. Il
> faudrait créer une nouvelle clé, puis désinstaller et réinstaller les applications sur chaque téléphone.
> **Clé volée** (fichier et mot de passe) : changez de clé sans attendre (même conséquence) et remplacez les secrets.

## Étape 4 — Confier la clé à GitHub (quatre secrets)

1. Dans PowerShell, copiez le contenu de la clé sous forme de texte (rien ne s'affiche, le texte est mis dans le
   presse-papiers) :

   ```powershell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Documents\globus-android.jks")) | Set-Clipboard
   ```

2. Sur github.com, ouvrez le dépôt `Borislegangster/fullstackproject`, puis **Settings** › **Secrets and variables** ›
   **Actions** › **New repository secret**. Créez les quatre secrets suivants : le nom (**Name**) exactement comme
   ci-dessous, la valeur dans **Secret**, puis **Add secret**.

   | Name | Secret |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | collez (Ctrl+V) le texte copié au point 1 |
   | `ANDROID_KEYSTORE_PASSWORD` | le mot de passe de l'étape 1 |
   | `ANDROID_KEY_ALIAS` | `globus` |
   | `ANDROID_KEY_PASSWORD` | le **même** mot de passe |

3. Effacez le texte de la clé du presse-papiers : copiez n'importe quel mot. Si l'historique du presse-papiers de
   Windows est activé (touches **Windows + V**), supprimez-y aussi l'entrée.

GitHub ne réaffiche jamais un secret enregistré : on peut le remplacer (**Update**), pas le relire.

## Étape 5 — Vérifier

1. Sur GitHub : **Actions** › **GLOBUS V4 — qualité, sécurité, images, déploiement** › bouton **Run workflow** (à
   droite) › branche `main` › **Run workflow**. Ce lancement manuel fabrique et contrôle les applications, sans toucher
   au site en ligne.
2. Environ 25 minutes plus tard, ouvrez l'exécution. Le résumé indique « **Signature Android** : ✅ clé permanente »
   avec l'empreinte de la clé, et la version de chaque application (« GLOBUS Client : version 1.0.312 »…).
3. Les trois fichiers d'installation sont en bas de la page, section **Artifacts**.

Si l'étape « Signature Android (clé permanente) » est en échec, son message indique quoi corriger :

| Message | Correction |
| --- | --- |
| « secrets incomplets, il manque : … » | créez le secret cité, avec son nom exact |
| « n'est pas un texte base64 valide » | refaites le point 1 de l'étape 4, puis **Update** sur `ANDROID_KEYSTORE_BASE64` |
| « mot de passe ANDROID_KEYSTORE_PASSWORD incorrect » | **Update** sur `ANDROID_KEYSTORE_PASSWORD` |
| « alias ANDROID_KEY_ALIAS absent de la clé » | `ANDROID_KEY_ALIAS` doit valoir `globus` |
| « ANDROID_KEY_PASSWORD diffère… » ou fabrication en échec avec « Failed to read key » | `ANDROID_KEY_PASSWORD` doit être identique au mot de passe |

Tant que les secrets n'existent pas, les applications sont toujours fabriquées, avec un avertissement jaune « APK signés
avec une clé de débogage jetable ».

## Étape 6 — Sur les téléphones : le passage à la clé permanente (une seule fois)

Les applications installées jusqu'ici portent une clé jetable : la **première** version signée avec la clé permanente
demande, une dernière fois, de désinstaller l'ancienne.

1. Dans l'application, vérifiez que rien n'attend d'être envoyé (GLOBUS Terrain : écran **Synchronisation** sans
   opération en attente).
2. Désinstallez l'application (appui long sur l'icône › **Désinstaller**).
3. Installez le nouveau fichier `.apk`, puis reconnectez-vous.

Ensuite, chaque nouvelle version s'installe par-dessus : ouvrez le fichier, touchez **Mettre à jour**.

## Le numéro de version

- Chaque fabrication sur GitHub est numérotée `1.0.<n>`, où `<n>` est le numéro de l'exécution (« GLOBUS V4 #312 »
  donne la version `1.0.312`). Les fichiers portent ce numéro : `GLOBUS-Client-1.0.312.apk`,
  `GLOBUS-Terrain-1.0.312.apk`, `GLOBUS-Direction-1.0.312.apk`.
- Version installée sur un téléphone : dans l'application, **Mon compte › Profil**, en bas de l'écran ; ou dans Android,
  **Paramètres › Applications › GLOBUS …**.
- Android refuse d'installer une version plus ancienne par-dessus une plus récente : transmettez toujours le fichier au
  plus grand numéro.
- Pour annoncer une grande évolution (`1.1`, `2.0`…) : modifiez la ligne `version:` du fichier `pubspec.yaml` de chaque
  application ; seuls les deux premiers nombres comptent, le troisième reste le numéro d'exécution.

## Pour les techniciens

- Job `mobile` de `.github/workflows/globus-v4.yml` : `packages/globus_core/tool/android_signing.py` décode la clé dans
  `$RUNNER_TEMP` (droits 0600), la contrôle avec `keytool` (mot de passe passé par variable d'environnement), écrit
  `apps/mobile-*/android/key.properties` (lu par `android/app/build.gradle.kts`) et les supprime en fin de job
  (`--clean`). Aucune valeur n'est affichée ; seule l'empreinte SHA-256 du certificat (publique) l'est. Sans secrets :
  avertissement et clé de débogage ; secrets incomplets ou invalides : échec.
- `flutter build apk --build-name=<majeur.mineur du pubspec>.<run_number> --build-number=<run_number>` :
  `versionCode` = `github.run_number`. Renommer ou recréer le fichier du workflow remet ce compteur à zéro : ajoutez
  alors à `BUILD_NUMBER` un décalage supérieur au dernier numéro publié.
- Fabrication locale (`flutter build apk` sur un PC) : version du `pubspec.yaml` (`1.0.0+1`) et clé de débogage, sauf
  fichier `android/key.properties` local. Un tel APK ne peut pas remplacer une version de la CI (numéro inférieur,
  signature différente) : réservé aux tests.
- iOS n'est pas concerné (signature par le compte Apple Developer, voir [MOBILE.md](MOBILE.md)).
