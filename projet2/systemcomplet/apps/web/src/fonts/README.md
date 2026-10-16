# Polices de la charte GLOBUS (§3 « Charte graphique obligatoire »)

| Rôle | Police | Fichiers | Chargement |
| --- | --- | --- | --- |
| Display : titres, identité, chiffres clés | **Gilroy** 500 / 600 / 700 | `Gilroy-Medium.woff2`, `Gilroy-SemiBold.woff2`, `Gilroy-Bold.woff2` | `next/font/local` (`src/app/fonts.ts`), variable `--font-gilroy`, classe `font-title` (h1–h4 par défaut) |
| UI / corps : formulaires, tableaux, navigation | **Poppins** 300–700 | paquet npm `@fontsource/poppins` | `src/app/layout.tsx`, classe `font-sans` (défaut) |
| Accent : éléments graphiques spécifiques | **Doxent** 400 | `Doxent-Regular.woff2` | `next/font/local`, variable `--font-doxent`, classe `font-accent` |

Toutes les polices sont auto-hébergées (aucun appel à un service tiers) et préchargées ; les métriques de repli sont
ajustées pour éviter tout décalage de mise en page.

## Licences

- **Gilroy** (Radomir Tinkov) : police commerciale — l'usage web (embarquement `@font-face`) nécessite une licence
  web au nom de GLOBUS ENGINEERING, à conserver avec les justificatifs de la charte.
- **Poppins** : SIL Open Font License 1.1.
- **Doxent** (OnlineWebFonts) : CC BY 4.0 — attribution obligatoire, présente dans les mentions légales (contenu
  initial du CMS) : « Fonts made from Web Fonts is licensed by CC BY 4.0 ».

Les mêmes fichiers alimentent les PDF générés par l'API (`backend/app/assets/fonts`).
