/** Les legendes des constellations : un court recit, d'ou vient le nom, et une
 * gravure ancienne du domaine public. Ecrit a la main, sans reseau, pour que
 * la legende se lise hors ligne ; seule la gravure vient d'internet.
 *
 * Les constellations modernes (creees par un astronome apres l'Antiquite)
 * n'ont pas de mythe : leur fiche le dit et donne leur origine, plutot que
 * d'en inventer un. Le recit antique, lui, a des variantes : on donne la plus
 * repandue et on signale les autres. */

export interface Engraving {
  /** Nom du fichier sur Wikimedia Commons. */
  file: string;
  /** Dimensions de l'original : reserve la place avant le chargement. */
  width: number;
  height: number;
  /** Ce qu'on lit sous l'image : auteur, ouvrage, date. */
  credit: string;
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
  engraving?: Engraving;
}

/** Les planches du Miroir d'Uranie (Sidney Hall, 1824) : domaine public. */
const URANIA = "Sidney Hall, Urania's Mirror (1824)";

export const LEGENDS: Record<string, Legend> = {
  Ori: {
    origin: "antique",
    tagline: "Le chasseur géant",
    text: [
      "Orion est un chasseur géant, fils de Poséidon dans la plupart des récits grecs. Il se vante de pouvoir abattre toutes les bêtes de la Terre. Gaïa, offensée, envoie un scorpion qui le tue d'une piqûre.",
      "Zeus les place tous deux dans le ciel, mais aux deux bouts : Orion se couche quand le Scorpion se lève, et on ne les voit presque jamais ensemble.",
      "Dans d'autres versions, c'est Artémis qui le tue par erreur, trompée par son frère Apollon.",
    ],
    source: "Récit résumé d'après Hygin (L'Astronomie poétique) et Ovide (Les Fastes).",
    engraving: {
      file: "Sidney Hall - Urania's Mirror - Orion (best currently available version - 2014).jpg",
      width: 1252,
      height: 1800,
      credit: URANIA,
    },
  },
  Cas: {
    origin: "antique",
    tagline: "La reine vaniteuse d'Éthiopie",
    text: [
      "Cassiopée, reine d'Éthiopie, se vante d'être plus belle que les Néréides, les nymphes de la mer. Poséidon, courroucé, envoie un monstre marin ravager le royaume.",
      "Pour l'apaiser, le roi Céphée doit livrer sa fille Andromède au monstre, enchaînée à un rocher. Persée la délivre.",
      "Cassiopée est punie : attachée à son trône, elle tourne autour du pôle Nord céleste et passe une partie de la nuit la tête en bas.",
      "Toute la famille est au ciel : Céphée, Andromède, Persée, et même le monstre, la Baleine.",
    ],
    source: "Récit résumé d'après la tradition gréco-latine (Ovide, Hygin).",
    engraving: {
      file: "Sidney Hall - Urania's Mirror - Cassiopeia (image right side up).jpg",
      width: 2486,
      height: 3572,
      credit: URANIA,
    },
  },
  Lyn: {
    origin: "moderne",
    tagline: "Une constellation moderne, sans mythe",
    text: [
      "Le Lynx n'a pas de légende antique. L'astronome polonais Johannes Hevelius l'a tracé à la fin du XVIIe siècle pour combler le vide entre le Cocher et la Grande Ourse.",
      "Ses étoiles sont faibles : Hevelius disait qu'il faut des yeux de lynx pour la distinguer, d'où son nom.",
      "Elle paraît en 1690, dans l'atlas posthume de Hevelius, le Firmamentum Sobiescianum.",
    ],
    source: "Constellation créée par Johannes Hevelius, publiée en 1690.",
    engraving: {
      file: "Sidney Hall - Urania's Mirror - Lynx and Telescopium Herschilii.jpg",
      width: 3599,
      height: 2516,
      credit: `${URANIA}, planche « Lynx et Telescopium Herschelii »`,
    },
  },
};

/** Largeur demandee a Commons : assez pour un telephone, sans tirer
 * l'original de plusieurs megaoctets. */
const ENGRAVING_WIDTH = 800;

/** Adresse de la gravure (Commons redirige vers l'image a la bonne taille,
 * comme pour les photos des planetes, voir bodies.py). */
export function engravingUrl(file: string): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${ENGRAVING_WIDTH}`;
}
