import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "public/sw.js", "src/generated/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      // Textes français : apostrophes typographiques omniprésentes, rendu sûr côté React.
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
