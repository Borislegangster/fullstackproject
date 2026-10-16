# Test de production sur AWS (en attendant le VPS Hostinger)

Un seul serveur EC2 exécute **exactement** la pile du futur VPS (`docker-compose.yml` + `scripts/deploy.sh`) :
la bascule vers Hostinger reprendra les mêmes commandes. Tout est décrit en CloudFormation (`globus-test.yaml`) :
une commande crée l'environnement, une commande le supprime entièrement.

| Élément | Choix |
| --- | --- |
| Région | `eu-west-3` (Paris) |
| Machine | EC2 `t3.large` (2 vCPU, 8 Gio — gabarit d'un VPS Hostinger KVM 2), Ubuntu 24.04, disque gp3 40 Gio chiffré, swap 4 Gio |
| Réseau | VPC dédié, IP élastique, ports 80/443 (+ TURN des appels) ; **aucun port SSH** (administration par SSM) |
| Identité | rôle IAM minimal : SSM, lecture du bucket de livraison, envoi SES |
| E-mails | Amazon SES via le rôle de la machine (`EMAIL_PROVIDER=ses`) : aucun mot de passe stocké |
| Secrets applicatifs | générés **sur le serveur** par `init-env.sh` (fichiers 0600), jamais transmis |
| Premier administrateur | invité par lien d'activation (`create_admin.py --invite`) : il choisit son mot de passe puis sa double authentification |
| Paiements | désactivés (`--no-payments`) tant que les contrats MTN MoMo / Orange Money ne sont pas signés |

## Prérequis (poste local)

```bash
winget install -e --id Amazon.AWSCLI
aws configure sso          # recommandé (ou : aws configure, avec un utilisateur IAM — jamais le compte root)
export AWS_PROFILE=<profil>
```

Un sous-domaine que vous pouvez faire pointer (ex. `test.votre-domaine.cm`) — ou aucun : le nom public est alors
dérivé de l'IP fixe (`52-47-41-21.sslip.io`, certificat Let's Encrypt inclus) et les e-mails partent d'une adresse
expéditrice vérifiée dans SES.

## Mise en ligne

```bash
./infra/aws/globus-aws.sh up - admin@exemple.com expediteur@exemple.com   # sans domaine (sslip.io)
./infra/aws/globus-aws.sh up test.votre-domaine.cm admin@exemple.com      # avec domaine (DKIM SES sur le domaine)
./infra/aws/globus-aws.sh dns                                             # nom public (+ A et 3 CNAME DKIM si domaine)
./infra/aws/globus-aws.sh push                                            # code → serveur (archive S3 privée, 7 jours)
./infra/aws/globus-aws.sh init admin@exemple.com                          # configuration + secrets générés sur le serveur
./infra/aws/globus-aws.sh deploy                                          # contrôle DNS, images, certificat TLS, démarrage
./infra/aws/globus-aws.sh ses                                             # adresses vérifiées ? (cliquer les liens AWS)
./infra/aws/globus-aws.sh admin admin@exemple.com Prénom Nom              # lien d'activation du premier administrateur
./infra/aws/globus-aws.sh content                                         # contenus de base (brouillons) après activation
```

Les contenus de la vitrine sont créés **en brouillon** : les publier depuis l'ERP (CMS → pages → valider / publier).
Mises à jour ultérieures : `push` puis `deploy` (base, fichiers et certificats conservés).

Contrôles avant création : `cfn-lint`, `cfn-guard` (règles AWS Well-Architected Sécurité et Fiabilité ; exceptions
motivées dans le gabarit), puis validation du service CloudFormation par jeu de modifications.

## Exploitation

`status` (conteneurs, santé, disque, mémoire), `logs [service]`, `shell` (session interactive, plugin
Session Manager requis), `stop` / `start` (machine arrêtée : seuls le disque et l'IP restent facturés).

## Bac à sable SES

Tant que l'accès production SES n'est pas accordé (demande dans la console SES), seuls les destinataires vérifiés
reçoivent les e-mails (invitations, codes de connexion). Vérifier chaque testeur : console SES → Identités, ou
relancer `up` avec son adresse.

## Coût indicatif (à confirmer avec la calculatrice AWS)

Machine `t3.large` à Paris ≈ 0,09 à 0,10 $/h (≈ 70 $/mois allumée en continu), disque ≈ 4 $/mois, IPv4 publique
≈ 3,6 $/mois, SES 0,10 $ pour 1 000 e-mails. Machine arrêtée : ≈ 8 $/mois.

## Fin du test

```bash
./infra/aws/globus-aws.sh down      # supprime machine, base, fichiers, IP, bucket et identités SES
```

Retirez ensuite les enregistrements DNS du sous-domaine.
