import type { Legend } from "./legends.ts";

/** Les constellations modernes : creees par des astronomes et des
 * navigateurs entre la fin du XVIe et le milieu du XVIIIe siecle. Aucun mythe
 * ne s'y rattache : chaque fiche dit qui l'a creee, quand et pourquoi. Dates
 * et noms sont ceux de l'histoire de la cartographie celeste, pas des
 * legendes. */

const LACAILLE = "Constellation créée par Nicolas-Louis de Lacaille (années 1750).";
const KEYSER = "Constellation créée par Keyser et Houtman (1595-1597), publiée par Bayer en 1603.";
const HEVELIUS = "Constellation créée par Johannes Hevelius (1687), publiée en 1690.";

export const LEGENDS_MODERN: Record<string, Legend> = {
  Ant: {
    origin: "moderne",
    tagline: "La pompe à air",
    text: [
      "La Machine pneumatique est l'une des quatorze constellations que l'astronome français Nicolas-Louis de Lacaille a créées après deux ans d'observations au cap de Bonne-Espérance, dans les années 1750. Il leur a donné des noms d'instruments des sciences et des arts de son siècle.",
      "Elle représente une pompe à air, du type de celles des expériences du XVIIe siècle. Ses étoiles sont faibles, et aucune légende antique ne s'y rattache.",
    ],
    source: LACAILLE,
    plate: "hya",
  },
  Aps: {
    origin: "moderne",
    tagline: "L'oiseau sans pattes",
    text: [
      "L'Oiseau de paradis est l'une des douze constellations australes dessinées par les navigateurs néerlandais Pieter Dirkszoon Keyser et Frederick de Houtman, pendant leur voyage vers les Indes orientales (1595-1597).",
      "On croyait alors que cet oiseau d'Indonésie n'avait pas de pattes et ne se posait jamais : son nom latin, Apus, veut dire « sans pied ».",
      "Johann Bayer la fait connaître dans son atlas en 1603.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Cae: {
    origin: "moderne",
    tagline: "Le burin du graveur",
    text: [
      "Le Burin est l'une des constellations créées par Lacaille dans les années 1750. Il représente le burin, l'outil des graveurs et des sculpteurs. Son nom latin, Caelum, signifie à la fois « burin » et « ciel ».",
      "C'est une constellation discrète, dont toutes les étoiles sont faibles.",
    ],
    source: LACAILLE,
    plate: "cma",
  },
  Cam: {
    origin: "moderne",
    tagline: "La girafe",
    text: [
      "Petrus Plancius, pasteur et cartographe néerlandais, introduit la Girafe vers 1612 sur un globe céleste, pour combler un vaste vide du ciel du Nord.",
      "C'est une constellation très étendue, mais aux étoiles faibles, entre Persée, le Cocher, la Grande Ourse et le pôle Nord céleste.",
    ],
    source: "Constellation créée par Petrus Plancius (vers 1612).",
    plate: "cam",
  },
  CVn: {
    origin: "moderne",
    tagline: "Les deux chiens de chasse",
    text: [
      "Les Chiens de chasse sont une création de Johannes Hevelius, qui les décrit en 1687. Ils figurent deux lévriers, Astérion et Chara, que tient en laisse le Bouvier lancé à la poursuite de la Grande Ourse.",
      "Ils abritent des galaxies célèbres, dont celle du Tourbillon (M51).",
    ],
    source: HEVELIUS,
    plate: "boo",
  },
  Cha: {
    origin: "moderne",
    tagline: "Le caméléon",
    text: [
      "Le Caméléon fait partie des douze constellations australes dessinées par les navigateurs néerlandais Keyser et Houtman (1595-1597) et publiées par Bayer en 1603. Ils ont donné aux étoiles du Sud des noms d'animaux exotiques découverts en route.",
      "Il se trouve tout près du pôle Sud céleste.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Cir: {
    origin: "moderne",
    tagline: "Le compas du dessinateur",
    text: [
      "Le Compas est une création de Lacaille (années 1750), qui y voit le compas du dessinateur et du géomètre, parmi les instruments de son siècle.",
      "Cette petite constellation se niche juste à côté d'Alpha du Centaure.",
    ],
    source: LACAILLE,
  },
  Col: {
    origin: "moderne",
    tagline: "La colombe de Noé",
    text: [
      "La Colombe a été introduite en 1592 par Petrus Plancius. Elle représente la colombe de Noé, qui revient à l'arche avec un rameau d'olivier pour annoncer la fin du Déluge.",
      "Elle se trouve juste au sud du Lièvre et du Grand Chien.",
    ],
    source: "Constellation créée par Petrus Plancius (1592).",
    plate: "cma",
  },
  Cru: {
    origin: "moderne",
    tagline: "La croix des navigateurs",
    text: [
      "La Croix du Sud est la plus petite constellation du ciel, et l'une des plus célèbres. Pour les Grecs, ses étoiles faisaient partie du Centaure ; Petrus Plancius en fait une constellation à part, vers 1600, d'après les observations des navigateurs.",
      "Elle sert de repère pour trouver le sud, comme l'étoile Polaire pour le nord, et figure sur plusieurs drapeaux de l'hémisphère sud, dont ceux de l'Australie et de la Nouvelle-Zélande.",
    ],
    source: "Constellation individualisée par Petrus Plancius (vers 1600).",
  },
  Dor: {
    origin: "moderne",
    tagline: "Le poisson-dauphin",
    text: [
      "La Dorade est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Le poisson représenté est probablement la coryphène, ou dorade tropicale, que les marins voyaient poursuivre les poissons volants.",
      "La Grande Nuée de Magellan, galaxie satellite de la nôtre, s'étend en grande partie sur cette constellation.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  For: {
    origin: "moderne",
    tagline: "Le four du chimiste",
    text: [
      "Le Fourneau est une création de Lacaille (années 1750) : le four du chimiste, qu'il nomme en latin Fornax Chemica.",
      "Ses étoiles sont faibles : la plus brillante dépasse à peine la magnitude 4.",
    ],
    source: LACAILLE,
    plate: "eri",
  },
  Gru: {
    origin: "moderne",
    tagline: "La grue",
    text: [
      "La Grue est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Avec le Paon, le Phénix et le Toucan, elle forme la volière du ciel austral.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Hor: {
    origin: "moderne",
    tagline: "L'horloge à pendule",
    text: [
      "L'Horloge est une création de Lacaille (années 1750), en hommage à l'horloge à pendule, qui avait révolutionné la mesure du temps au siècle précédent.",
      "Ses étoiles sont faibles, dans un coin de ciel austral sans repère brillant.",
    ],
    source: LACAILLE,
  },
  Hyi: {
    origin: "moderne",
    tagline: "Le petit serpent d'eau",
    text: [
      "L'Hydre mâle est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Il ne faut pas la confondre avec l'Hydre, la grande constellation antique, aussi appelée Hydre femelle.",
      "Elle se glisse entre Achernar et le pôle Sud céleste.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Ind: {
    origin: "moderne",
    tagline: "L'Indien",
    text: [
      "L'Indien est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Elle représente un « Indien » tenant des flèches, sans plus de précision sur le peuple dont il s'agit.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Lac: {
    origin: "moderne",
    tagline: "Le lézard",
    text: [
      "Le Lézard est une création de Johannes Hevelius, qui le décrit en 1687. Il l'a dessiné pour combler l'espace entre le Cygne, Cassiopée et Andromède.",
      "Son tracé en zigzag ressemble à un W étiré, qu'on confond parfois avec celui de Cassiopée.",
    ],
    source: HEVELIUS,
    plate: "lyr",
  },
  LMi: {
    origin: "moderne",
    tagline: "Le petit lion",
    text: [
      "Le Petit Lion est une création de Johannes Hevelius (1687), pour combler l'espace entre la Grande Ourse et le Lion.",
      "C'est une constellation discrète, dont les étoiles sont faibles.",
    ],
    source: HEVELIUS,
    plate: "leo",
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
    plate: "lyn",
  },
  Men: {
    origin: "moderne",
    tagline: "La montagne de la Table",
    text: [
      "La Table est une création de Lacaille (années 1750). C'est la seule constellation qui rappelle un lieu réel : la montagne de la Table, qui domine la ville du Cap et d'où il observait.",
      "C'est la constellation la plus faible du ciel : aucune de ses étoiles ne dépasse la magnitude 5. La Grande Nuée de Magellan en occupe un coin.",
    ],
    source: LACAILLE,
  },
  Mic: {
    origin: "moderne",
    tagline: "Le microscope",
    text: [
      "Le Microscope est une création de Lacaille (années 1750), en hommage au microscope composé, instrument phare des sciences de son siècle.",
      "Ses étoiles sont faibles, dans une région discrète au sud du Capricorne.",
    ],
    source: LACAILLE,
    plate: "sgr",
  },
  Mon: {
    origin: "moderne",
    tagline: "La licorne",
    text: [
      "La Licorne a été introduite vers 1612 par Petrus Plancius. Elle remplit l'espace entre le Grand et le Petit Chien, à côté d'Orion.",
      "Elle est traversée par la Voie lactée et riche en amas et en nébuleuses, comme la nébuleuse de la Rosette.",
    ],
    source: "Constellation créée par Petrus Plancius (vers 1612).",
    plate: "mon",
  },
  Mus: {
    origin: "moderne",
    tagline: "La mouche",
    text: [
      "La Mouche est l'une des douze constellations australes de Keyser et Houtman. Bayer l'appelle d'abord « l'Abeille » (Apis) dans son atlas de 1603 ; Lacaille la renomme « la Mouche » au XVIIIe siècle.",
      "Elle n'a aucun rapport avec la Mouche boréale, une ancienne constellation du ciel nord aujourd'hui abandonnée.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Nor: {
    origin: "moderne",
    tagline: "La règle et l'équerre",
    text: [
      "La Règle est une création de Lacaille (années 1750) : la règle et l'équerre, outils du géomètre et du constructeur.",
      "Elle se trouve dans la Voie lactée australe, entre le Scorpion et le Loup.",
    ],
    source: LACAILLE,
  },
  Oct: {
    origin: "moderne",
    tagline: "L'octant",
    text: [
      "L'Octant est une création de Lacaille (années 1750), en l'honneur de l'octant, instrument de navigation inventé en 1730 par l'Anglais John Hadley.",
      "Elle contient le pôle Sud céleste. Sa petite étoile Sigma Octantis, de magnitude 5,4, est la plus proche de ce pôle parmi les étoiles visibles à l'œil nu : une étoile polaire australe bien peu brillante.",
    ],
    source: LACAILLE,
  },
  Pav: {
    origin: "moderne",
    tagline: "Le paon",
    text: [
      "Le Paon est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Cet oiseau est originaire des Indes, où les navigateurs néerlandais faisaient route.",
      "Avec la Grue, le Phénix et le Toucan, il forme la volière du ciel austral.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Phe: {
    origin: "moderne",
    tagline: "L'oiseau qui renaît de ses cendres",
    text: [
      "Le Phénix est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Il évoque l'oiseau de légende qui, selon les auteurs antiques, vit plusieurs siècles, meurt sur un bûcher et renaît de ses cendres.",
      "Les Grecs n'avaient pas placé le phénix dans le ciel : ce sont des navigateurs néerlandais qui l'y ont dessiné, à la fin du XVIe siècle.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Pic: {
    origin: "moderne",
    tagline: "Le chevalet du peintre",
    text: [
      "Le Peintre est une création de Lacaille (années 1750) : le chevalet et la palette, en hommage à l'art de peindre.",
      "Elle contient Beta Pictoris, entourée d'un disque de débris et de poussières, l'un des premiers observés autour d'une étoile (1984).",
    ],
    source: LACAILLE,
  },
  Pyx: {
    origin: "moderne",
    tagline: "La boussole du navire",
    text: [
      "La Boussole est une création de Lacaille (années 1750), la « boussole de mer » (Pyxis Nautica). Ses étoiles faisaient partie du mât du navire Argo : Lacaille les en détache pour y placer cet instrument de navigation.",
    ],
    source: LACAILLE,
    plate: "hya",
  },
  Ret: {
    origin: "moderne",
    tagline: "Le réticule du télescope",
    text: [
      "Le Réticule est une création de Lacaille (années 1750). Il évoque le réticule, le petit quadrillage de fils placé dans l'oculaire de sa lunette pour mesurer la position des étoiles.",
    ],
    source: LACAILLE,
  },
  Scl: {
    origin: "moderne",
    tagline: "L'atelier du sculpteur",
    text: [
      "Le Sculpteur est une création de Lacaille (années 1750) : l'atelier du sculpteur.",
      "Son ciel est pauvre en étoiles brillantes, mais il contient le pôle sud galactique : on y regarde à angle droit du disque de la Voie lactée, vers l'espace lointain, ce qui laisse voir de nombreuses galaxies.",
    ],
    source: LACAILLE,
    plate: "eri",
  },
  Sct: {
    origin: "moderne",
    tagline: "Le bouclier du roi de Pologne",
    text: [
      "L'Écu de Sobieski est une création de Johannes Hevelius, qui le nomme en 1684 en l'honneur du roi de Pologne Jean III Sobieski, vainqueur des Ottomans à Vienne en 1683.",
      "Il se trouve dans une riche région de la Voie lactée, avec l'amas du Canard sauvage (M11).",
    ],
    source: "Constellation créée par Johannes Hevelius (1684).",
    plate: "oph",
  },
  Sex: {
    origin: "moderne",
    tagline: "Le sextant de Hevelius",
    text: [
      "Le Sextant est une création de Johannes Hevelius (1687), en souvenir de son sextant, l'instrument qui lui servait à mesurer la position des étoiles, détruit dans l'incendie de son observatoire de Dantzig en 1679.",
      "Ses étoiles sont faibles, dans un coin discret au sud du Lion.",
    ],
    source: HEVELIUS,
    plate: "hya",
  },
  Tel: {
    origin: "moderne",
    tagline: "La lunette astronomique",
    text: [
      "Le Télescope est une création de Lacaille (années 1750), en hommage à l'instrument qui a changé l'astronomie.",
      "Ses étoiles sont faibles, au sud du Sagittaire et de la Couronne australe.",
    ],
    source: LACAILLE,
    plate: "sgr",
  },
  TrA: {
    origin: "moderne",
    tagline: "Le triangle du Sud",
    text: [
      "Le Triangle austral est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Son nom le distingue du Triangle antique, dans le ciel nord.",
      "Atria, son étoile principale, forme avec deux autres étoiles brillantes un triangle presque équilatéral.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Tuc: {
    origin: "moderne",
    tagline: "Le toucan",
    text: [
      "Le Toucan est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603. Cet oiseau d'Amérique du Sud, rapporté en Europe par les explorateurs, était une curiosité.",
      "Il abrite la Petite Nuée de Magellan, galaxie satellite de la Voie lactée, et l'amas globulaire 47 Tucanae, l'un des plus brillants du ciel.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Vol: {
    origin: "moderne",
    tagline: "Le poisson volant",
    text: [
      "Le Poisson volant est l'une des douze constellations australes de Keyser et Houtman, publiée par Bayer en 1603 sous le nom de Piscis Volans. Les marins voyaient ces poissons planer au-dessus des vagues.",
      "La Dorade, sa voisine dans le ciel, est justement le poisson qui les poursuit.",
    ],
    source: KEYSER,
    plate: "aus",
  },
  Vul: {
    origin: "moderne",
    tagline: "Le renard et l'oie",
    text: [
      "Le Petit Renard est une création de Johannes Hevelius (1687), qui l'appelait « le petit renard avec l'oie » : un renard portant une oie dans la gueule. L'oie a disparu des cartes depuis, mais le renard est resté.",
      "Il abrite la nébuleuse de l'Haltère (M27), l'une des plus belles nébuleuses planétaires, et le Cintre, un alignement d'étoiles que les jumelles révèlent bien.",
    ],
    source: HEVELIUS,
    plate: "lyr",
  },
};
