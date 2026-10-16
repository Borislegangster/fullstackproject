# Polices des documents PDF

Charte §3 : **Gilroy** (titres, identité) et **Poppins** (corps de texte). Fichiers WOFF2 convertis en TrueType en
mémoire au premier rendu (`fontTools`), puis enregistrés dans reportlab (`app/core/pdf.py`). En l'absence de
`fontTools`, les PDF retombent sur Helvetica (aucune erreur de génération).

- Gilroy : licence commerciale (voir `apps/web/src/fonts/README.md`).
- Poppins : SIL Open Font License 1.1 (`OFL-Poppins.txt`), sous-ensemble latin (français complet).
