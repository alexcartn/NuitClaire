/** Les legendes des constellations : un court recit, d'ou vient le nom, et une
 * gravure ancienne du domaine public. Ecrit a la main, sans reseau, pour que
 * la legende se lise hors ligne ; seule la gravure vient d'internet.
 *
 * Les constellations modernes (creees par un astronome apres l'Antiquite)
 * n'ont pas de mythe : leur fiche dit qui les a creees, quand et pourquoi,
 * plutot que d'en inventer un. Le recit antique, lui, a des variantes : on
 * donne la plus repandue et on signale les autres.
 *
 * Les textes sont dans legendsAncient.ts et legendsModern.ts, les planches
 * dans legendPlates.ts. */
import { LEGENDS_ANCIENT } from "./legendsAncient.ts";
import { LEGENDS_MODERN } from "./legendsModern.ts";
import { PLATES } from "./legendPlates.ts";

/** Une planche gravee sur Wikimedia Commons. */
export interface Plate {
  /** Nom du fichier sur Commons. */
  file: string;
  /** Dimensions de l'original : reserve la place avant le chargement. */
  width: number;
  height: number;
  /** Titre de la planche, en francais (elle couvre souvent plusieurs
   * constellations). */
  title: string;
  /** Urania's Mirror (Sidney Hall, 1824) ou la planche australe de Bayer. */
  source: "urania" | "bayer";
  /** Largeur demandee a Commons quand l'image par defaut serait trop lourde
   * (un PNG de 1,2 Mo a 800 px). */
  thumbWidth?: number;
}

/** Ce que la page affiche sous le texte. */
export interface Engraving {
  file: string;
  width: number;
  height: number;
  /** Ce qu'on lit sous l'image : auteur, ouvrage, date, planche. */
  credit: string;
  thumbWidth?: number;
}

export interface Legend {
  /** Antique : un recit transmis par les Grecs et les Latins. Moderne :
   * creee par un astronome, aucun mythe. */
  origin: "antique" | "moderne";
  /** Une ligne sous le nom. */
  tagline: string;
  /** Paragraphes. */
  text: string[];
  /** D'ou vient le recit. */
  source: string;
  /** Cle de la planche (voir PLATES) ; absente quand aucune gravure du
   * domaine public n'a ete trouvee pour cette constellation. */
  plate?: string;
}

export const LEGENDS: Record<string, Legend> = { ...LEGENDS_ANCIENT, ...LEGENDS_MODERN };

export { PLATES };

/** Largeur demandee a Commons : assez pour un telephone, sans tirer
 * l'original de plusieurs megaoctets. */
const ENGRAVING_WIDTH = 800;

/** Adresse de la gravure (Commons redirige vers l'image a la bonne taille,
 * comme pour les photos des planetes, voir bodies.py). */
export function engravingUrl(file: string, width = ENGRAVING_WIDTH): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
}

/** La mention sous l'image : qui l'a gravee, dans quel ouvrage, et de quelle
 * planche il s'agit. */
export function plateCredit(plate: Plate): string {
  return plate.source === "bayer"
    ? `Johann Bayer, Uranometria (édition de 1661), ${plate.title}`
    : `Sidney Hall, Urania's Mirror (1824), planche « ${plate.title} »`;
}

/** La gravure de cette legende, ou null quand on n'en a pas. */
export function engravingOf(legend: Legend): Engraving | null {
  const plate = legend.plate ? PLATES[legend.plate] : undefined;
  if (!plate) return null;
  return { file: plate.file, width: plate.width, height: plate.height, credit: plateCredit(plate), thumbWidth: plate.thumbWidth };
}
