import localFont from "next/font/local";

/**
 * Polices de la charte (§3 « Charte graphique obligatoire ») auto-hébergées et préchargées :
 *  - Gilroy : display — titres, identité, chiffres clés ;
 *  - Doxent : accent — titres ou éléments graphiques spécifiques ;
 *  - Poppins (UI / corps) : paquet @fontsource importé dans le layout racine.
 * Les métriques de repli sont ajustées automatiquement (pas de saut de mise en page au chargement).
 */
export const gilroy = localFont({
  src: [
    { path: "../fonts/Gilroy-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Gilroy-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../fonts/Gilroy-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-gilroy",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
  adjustFontFallback: "Arial",
});

export const doxent = localFont({
  src: [{ path: "../fonts/Doxent-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-doxent",
  display: "swap",
  fallback: ["ui-serif", "Georgia", "serif"],
  adjustFontFallback: "Times New Roman",
});
