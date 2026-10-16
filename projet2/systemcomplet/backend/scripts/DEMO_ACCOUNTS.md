# Comptes de démonstration (environnement local uniquement)

Créés par `python scripts/seed_demo.py` — **refusé en production** (`ENV=production`).

Mot de passe commun à tous les comptes de démonstration : `Globus!Demo2026`
(défini dans `app/seeds/demo.py`, constante `DEMO_PASSWORD`).

| Compte | Rôle | Usage |
|---|---|---|
| admin@globus.demo | ADMIN | Administration, paramètres, sécurité, sauvegardes |
| direction@globus.demo | DIRECTION | Tableau de bord Direction, dérogations, attributions |
| chef.projet@globus.demo | CHEF_PROJET | Projets, planning, validations, décisions client |
| architecte@globus.demo | ARCHITECTE | GED, Hub BIM, configurateur |
| ingenieur@globus.demo | INGENIEUR | Issues BIM, conflits, notes de calcul |
| chef.chantier@globus.demo | CHEF_CHANTIER | Terrain : DA, réceptions, pointage, QHSE |
| technicien@globus.demo | TECHNICIEN | Tâches assignées, interventions SAV |
| commercial@globus.demo | COMMERCIAL | CRM : leads, devis, contrats |
| marketing@globus.demo | MARKETING | CMS vitrine, médiathèque, SEO, newsletter |
| acheteur@globus.demo | ACHETEUR | Achats, fournisseurs, livraisons |
| magasinier@globus.demo | MAGASINIER | Stocks, matériel |
| qhse@globus.demo | QHSE | Inspections, incidents, actions correctives |
| finance@globus.demo | FINANCE | Facturation, paiements (initiateur) |
| comptable@globus.demo | FINANCE | Paiements (approbateur — séparation des tâches) |
| rh@globus.demo | RH | Employés, pointage, paie |
| client@globus.demo | CLIENT | Espace client (projet diaspora « Villa Nguema ») |
| investisseur@globus.demo | CLIENT | Espace client (immeuble R+4 Akwa) |
| fournisseur@globus.demo | FOURNISSEUR | Extranet fournisseur |
| soustraitant@globus.demo | SOUS_TRAITANT | Extranet sous-traitant |

Le MFA n'est pas activé sur ces comptes (`MFA_ENFORCEMENT=warn` en local). Les messages WhatsApp / SMS / e-mails
sont capturés par les prestataires « console » (aucun envoi réel).

Paiements en ligne : uniquement des prestataires réels. Pour tester en local, utilisez les environnements de test
officiels : bac à sable MTN MoMo (clé d'abonnement obtenue sur momodeveloper.mtn.com, puis
`python scripts/momo_sandbox_user.py`) et/ou environnement « dev » Orange Money Web Payment, puis lancez l'API avec
`PAYMENT_PROVIDERS=mtn_momo,orange_money`. Sans prestataire configuré, l'espace client n'affiche aucun moyen de
paiement en ligne.
