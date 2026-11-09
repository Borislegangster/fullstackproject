/** Lignes visibles des textes repliés (« Lire plus »), communes à toute la vitrine. Module sans « use client » : les
 * composants serveur y lisent les valeurs elles-mêmes (une constante importée d'un module client n'est qu'une
 * référence côté serveur). */

/** Un nombre, ou [mobile, tablette (≥ 640 px), ordinateur (≥ 1024 px)]. */
export type Lines = number | [number, number?, number?];

export const READ_MORE = {
  lead: [6, 6, 7] as Lines, // texte d'introduction d'une page (univers, offre, expertise)
  hero: [4, 4, 5] as Lines, // résumé dans un en-tête sombre
  rich: [11, 12, 14] as Lines, // bloc de texte riche du CMS (titres et marges comptent dans la hauteur)
  card: [6, 6, 7] as Lines, // carte (défi, réponse, témoignage, biographie)
  small: [5, 5, 5] as Lines, // encart latéral, carte de fonctionnalité, étape
  caption: [3, 3, 3] as Lines, // légende courte (vidéo)
};
