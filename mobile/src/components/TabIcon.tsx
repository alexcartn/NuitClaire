/** Icones de la barre d'onglets, dessinees en SVG inline.
 *
 * Avant : des glyphes Unicode (☾ ◎ ▦ ✎ ⚙). Simples a poser, mais rendus par
 * la police du systeme : taille optique, epaisseur de trait et alignement
 * vertical changent d'un telephone a l'autre, et certains glyphes tombent
 * sur une variante emoji en couleur. En SVG le rendu est le meme partout et
 * l'epaisseur de trait est celle qu'on choisit.
 *
 * Toujours pas de bibliotheque d'icones : cinq dessins de quelques lignes,
 * sur la meme grille de 24 et le meme trait que le croissant de l'icone de
 * l'appli (voir scripts/build_icons.py). `currentColor` laisse la couleur
 * active/inactive au CSS (voir `.nc-tab-icon` dans theme.css).
 *
 * Les memes dessins servent aux quelques boutons d'icone hors de la barre
 * (recherche, retour, actualiser) : le « ⌕ » Unicode de la recherche avait
 * exactement les defauts qui ont fait abandonner les glyphes ici. */
import type { ReactNode } from "react";

export type TabIconName = "moon" | "target" | "grid" | "notebook" | "sliders" | "search" | "back" | "refresh" | "chevron" | "close" | "sky";

const PATHS: Record<TabIconName, ReactNode> = {
  // Croissant, comme l'icone de l'appli : la nuit en cours.
  moon: <path d="M20.5 14.6A8.8 8.8 0 0 1 9.4 3.5 8.8 8.8 0 1 0 20.5 14.6Z" />,
  // Reticule : les cibles pointables ce soir.
  target: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="1.4" />
      <path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6" />
    </>
  ),
  // Grille : le catalogue Messier, distincte du reticule.
  grid: (
    <>
      <rect x="3.6" y="3.6" width="7" height="7" rx="1.6" />
      <rect x="13.4" y="3.6" width="7" height="7" rx="1.6" />
      <rect x="3.6" y="13.4" width="7" height="7" rx="1.6" />
      <rect x="13.4" y="13.4" width="7" height="7" rx="1.6" />
    </>
  ),
  // Carnet : le journal d'observation (un carnet plutot qu'un crayon --
  // l'onglet montre surtout ce qui est deja ecrit).
  notebook: (
    <>
      <rect x="5" y="3.4" width="14" height="17.2" rx="2" />
      <path d="M9 3.4v17.2M11.8 9h4.4M11.8 13.2h4.4" />
    </>
  ),
  // Curseurs : les reglages. Une roue crantee devient illisible a 20 px.
  // Chaque trait s'interrompt de part et d'autre de sa molette : superposes,
  // trait et cercle se brouillent des qu'on descend a 20 px.
  sliders: (
    <>
      <path d="M3.5 7h3.2M11.3 7h9.2" />
      <path d="M3.5 12h9.7M17.8 12h2.7" />
      <path d="M3.5 17h1.7M9.8 17h10.7" />
      <circle cx="9" cy="7" r="2.1" />
      <circle cx="15.5" cy="12" r="2.1" />
      <circle cx="7.5" cy="17" r="2.1" />
    </>
  ),
  // Loupe : la recherche par designation.
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5.5 5.5" />
    </>
  ),
  // Chevron vers le bas : section repliable (tourne quand elle s'ouvre).
  chevron: <path d="M6 9.5l6 6 6-6" />,
  // Etoile a quatre branches : la carte du ciel.
  sky: <path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9L12 20.5l-1.9-6.6L3.5 12l6.6-1.9Z" />,
  // Croix : vider un champ.
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  // Chevron : revenir a l'ecran d'avant.
  back: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  // Fleche circulaire : recharger la prevision.
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.8 4.2v4.3h-4.3" />
    </>
  ),
};

export function TabIcon({ name }: { name: TabIconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
