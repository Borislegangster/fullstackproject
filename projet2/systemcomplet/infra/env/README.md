# infra/env — fichiers d'environnement de production

Générés **sur le serveur** par `../scripts/init-env.sh` (droits 0600), jamais versionnés :

| Fichier | Contenu |
| --- | --- |
| `compose.env` | domaine, version, IP publique (interpolation Compose) |
| `postgres.env` | base, utilisateur et mot de passe PostgreSQL |
| `api.env` | configuration API + worker (clés de chiffrement, JWT, Redis, TURN, intégrations) |
| `web.env` | URL interne de l'API, URL publique du site, secret de revalidation CMS |
| `turnserver.conf` | configuration coturn (secret partagé TURN) |

Les clés des intégrations (SMTP, paiement, WhatsApp, Twilio, APS, Anthropic) peuvent être saisies dans
l'administration (Paramètres → Intégrations) : elles sont alors stockées chiffrées en base (AES-256-GCM) et
prioritaires sur ces fichiers.
