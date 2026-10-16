---
id: client-preuves
title: Preuves certifiées
space: client
section: Mon projet
order: 80
route: /espace-client/preuves
summary: Chaque décision validée, document publié et lot de photos est scellé par son empreinte numérique - téléchargez le certificat et vérifiez un fichier vous-même.
keywords: [preuve, certificat, empreinte, SHA-256, horodatage, OpenTimestamps, vérifier, authenticité, intégrité]
related: [client-documents, client-validations]
---

## Principe

Menu **Preuves certifiées** : chaque décision validée, document publié et lot de photos de votre chantier est scellé par son empreinte numérique (SHA-256). Il est impossible de le modifier sans que cela se voie. Les preuves horodatées publiquement (OpenTimestamps) sont vérifiables sans dépendre de GLOBUS.

## Utiliser une preuve

Chaque preuve indique son titre, sa date, son statut d'ancrage et les éléments scellés.

1. **Certificat** télécharge le certificat de la preuve (PDF).
2. **Vérifier un fichier** ouvre la page de vérification : déposez le fichier que vous détenez ; son empreinte est recalculée sur votre appareil (le fichier n'est pas envoyé) et comparée à celle certifiée.
3. Une preuve marquée **Révoquée** a été remplacée (document corrigé, par exemple) : la nouvelle version a sa propre preuve.
