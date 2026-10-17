---
id: erp-application-terrain
title: L'application mobile GLOBUS Terrain
space: erp
section: Prise en main
order: 15
routes: [/erp/terrain, /erp/rh/mon-espace]
summary: Application unique du personnel (chantier, logistique, QHSE, SAV, RH) — écrans selon votre rôle, travail hors ligne, scanner universel, synchronisation sans écrasement.
keywords: [application, mobile, terrain, chantier, hors ligne, synchronisation, conflit, scanner, QR, pointage, réception, incident, rapport vocal, photo, android, iphone]
related: [erp-premiers-pas, erp-chantier-suivi, erp-livraisons, erp-stocks, erp-qhse, erp-rh, erp-sav]
---

## Une seule application pour tout le personnel

**GLOBUS Terrain** (Android et iPhone) sert à tous les métiers : chef de chantier, conducteur de travaux, chef d'équipe, magasinier, technicien SAV, animateur QHSE, ouvrier. Chacun ne voit que les rubriques de son rôle et de son métier — exactement les mêmes droits que dans l'ERP web.

1. Ouvrez l'application, saisissez votre e-mail et votre mot de passe, puis **Se connecter**.
2. Saisissez le code de votre application d'authentification si la double authentification est active (obligatoire pour l'encadrement).
3. Le **chantier courant** s'affiche sous la barre du haut : touchez-le pour changer de chantier parmi ceux qui vous sont affectés. Toutes les rubriques travaillent sur ce chantier.

## Accueil chantier

L'accueil affiche l'avancement, l'état de la synchronisation, les **actions rapides** autorisées (scanner, rapport vocal, photo, journal, incident, réception, pointage, stock), vos tâches en cours et les indicateurs du chantier. Tirez vers le bas pour actualiser et envoyer ce qui attend.

## Travailler sans réseau

Tout ce que vous saisissez sur le chantier est **enregistré chiffré sur le téléphone** puis envoyé automatiquement : au retour du réseau, à la réouverture de l'application et toutes les 2 minutes.

- Fonctionne hors ligne : avancement des tâches, journal de chantier, photos et vidéos, rapports vocaux, incidents (avec photos), pointage des badges et auto-pointage, sorties de stock.
- Chaque saisie porte un identifiant unique : un renvoi après une coupure ne crée **jamais de doublon**.
- Les écrans déjà consultés restent lisibles hors ligne (bandeau « hors ligne » et date de la dernière mise à jour).

### Conflits

Si une donnée a été modifiée au bureau pendant que vous étiez hors ligne (par exemple l'avancement d'une tâche), votre saisie **n'écrase rien** : elle passe en conflit. Ouvrez **Synchronisation**, comparez « Bureau » et « Moi » champ par champ, puis choisissez **Garder le bureau**, **Garder ma version** ou **Fusionner**. Chaque arbitrage est tracé dans le journal d'audit.

Une saisie refusée par le serveur (droit manquant, article introuvable…) reste visible avec le motif : corrigez puis **Abandonner** l'ancienne.

> À la déconnexion, les saisies non envoyées sont effacées du téléphone : synchronisez avant de vous déconnecter.

## Scanner universel

Un seul bouton **Scanner** lit tous les QR GLOBUS :

| QR | Ce qui s'ouvre |
|---|---|
| Zone / pièce | Plans autorisés, maquette 3D, tâches et check-lists de la zone, photos avant / après, issues BIM |
| Chantier | Auto-pointage arrivée / départ avec la position du téléphone |
| Badge ouvrier | Pointage de l'ouvrier par l'encadrement (hors ligne possible) |
| Bon de commande | Réception de la livraison |
| Matériel | Fiche de l'engin, relevé d'utilisation, panne |

Sans caméra, saisissez le code imprimé sous le QR.

## Rubriques chantier

- **Mes tâches** : avancement (curseur), check-list, photos, zone ; la planification complète est dans **Planning**.
- **Journal de chantier** : rapport du jour (météo, effectifs, travaux, incidents, besoins), soumission au chef de projet.
- **Photos et vidéos** : étape, légende, publication client éventuelle ; position GPS ajoutée.
- **Rapports vocaux** : dictez, l'assistant propose un texte et des champs ; vous validez ou corrigez avant toute utilisation.
- **Plans et maquette** : seule la **version publiée** de chaque plan est accessible. Un bandeau rouge **Plan périmé** prévient si un plan téléchargé sur ce téléphone a été remplacé : ouvrez la version en vigueur avant d'exécuter.
- **Issues BIM** : issues qui vous sont assignées, changement de statut et commentaires.

## Logistique

- **Livraisons** : commandes attendues sur le chantier ; **Réceptionner** (QR ou numéro du bon de commande) → quantités reçues et refusées avec motif, entrepôt ou affectation au chantier, chauffeur, photos et bon de livraison (au moins une pièce), puis **Valider la réception**. Un double appui ne crée jamais deux réceptions.
- **Lecture de documents (IA)** : photographiez un bon de livraison ou une facture ; les données lues sont proposées, jamais appliquées sans votre validation.
- **Stock chantier** : matériaux réservés (sortir, déclarer consommé, retourner), niveaux par entrepôt, sortie vers le chantier même hors ligne, comptage des inventaires (la validation reste au bureau).
- **Matériel et engins** : relevé du jour (heures, km, carburant), panne / casse avec photos, position (si le suivi est activé pour l'engin), affectation et restitution (parc).

## Sécurité, SAV et personnel

- **QHSE** : **Signaler** un incident (nature, gravité, circonstances, photos — même hors ligne), inspections à réaliser point par point (une non-conformité ouvre une action corrective), **Mes actions** à terminer avec preuve photo, quarts d'heure sécurité (ouvriers pointés du jour pré-cochés).
- **SAV et entretien** : tickets qui vous sont affectés (diagnostic, photos avant / après, clôture avec preuves), entretiens programmés du bâtiment livré (**Fait** programme la prochaine échéance).
- **Pointage** : auto-pointage par le QR du chantier (position obligatoire, hors périmètre signalé à votre responsable) ; pour l'encadrement, scan des badges et validation des présences du jour.
- **Mon espace RH** : vos pointages et heures du mois, vos demandes de congé (**Demander**), vos bulletins de paie (ouverture journalisée, filigrane à votre nom).

## Échanges et notifications

Messagerie du chantier, appels audio / vidéo, agenda et notifications sont identiques à l'ERP web. Une notification touchée ouvre directement l'écran concerné dans l'application (incident, réception, ticket, issue…) ; un lien sans équivalent mobile s'ouvre dans le navigateur.
