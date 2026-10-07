import type { LegendDetail } from "./legends.ts";
import { KEYSER, LACAILLE } from "./legendsDetailsE.ts";

/** Developpements historiques, sixieme lot : constellations modernes, de la
 * Table au Petit Renard. */
export const DETAILS_F: Record<string, LegendDetail[]> = {
  Men: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Lacaille avait installé son observatoire au pied de la montagne de la Table, à l'origine du nom.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La Table est la constellation la plus faible du ciel : la plus brillante, Alpha Mensae, est de magnitude 5,1. Une partie du Grand Nuage de Magellan y déborde, mais l'essentiel est dans la Dorade.",
      ],
    },
  ],
  Mic: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le microscope est celui de Robert Hooke, dont la Micrographia (1665) fait découvrir au grand public le monde de l'infiniment petit, et d'Antoni van Leeuwenhoek.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La constellation est faible : sa plus brillante étoile, gamma, est de magnitude 4,7. AU Microscopii, une jeune étoile naine rouge à une trentaine d'années-lumière, est entourée d'un disque de débris ; en 2020, on y a découvert une planète, grâce aux télescopes spatiaux TESS et Spitzer.",
      ],
    },
  ],
  Mon: [
    {
      kind: "origines",
      text: [
        "Plancius, pasteur calviniste et cartographe d'origine flamande, la place sur un globe céleste ; Jakob Bartsch la reprend en 1624. Dans d'anciennes traductions de la Bible, le re'em, un animal puissant, est rendu par « licorne ».",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Aucune étoile de la Licorne n'est plus brillante que la magnitude 3,7. Bêta Monocerotis est un beau système triple, que William Herschel découvre en 1781 et qu'il juge l'un des plus beaux spectacles du ciel.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La Licorne est traversée par la Voie lactée d'hiver. On y trouve la nébuleuse de la Rosette, une immense région de formation d'étoiles qu'éclaire un amas ouvert en son centre.",
      ],
    },
  ],
  Mus: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Sur le globe de Plancius, c'est « la Mouche » (De Vlieghe) ; Bayer la rebaptise « l'Abeille » (Apis) en 1603 ; Lacaille revient à la Mouche au XVIIIe siècle.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La Mouche borde le Sac à charbon, nébuleuse sombre qui s'étend sur la Croix du Sud, la Mouche et le Centaure.",
      ],
    },
  ],
  Nor: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "La Règle est l'équerre et la règle des géomètres et des maçons. Son nom latin, Norma, signifie « équerre » : il a donné les mots « norme » et « normal ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Dans cette direction se trouve l'amas de la Règle, au centre du « Grand Attracteur », une concentration de masse qui attire notre galaxie et des milliers d'autres.",
      ],
    },
  ],
  Oct: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Lacaille l'appelle l'« octant de Hadley », du nom de l'inventeur anglais de l'instrument.",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Sigma Octantis, l'étoile « polaire » australe, est de magnitude 5,4 : trop faible pour guider. Les marins de l'hémisphère sud trouvent le pôle Sud céleste avec la Croix du Sud et les deux « Pointeurs », Alpha et Bêta du Centaure.",
      ],
    },
  ],
  Pav: [
    {
      kind: "origines",
      text: [
        KEYSER,
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Peacock, alpha, n'a pas de nom ancien : il a été créé en 1937 par le Nautical Almanac Office britannique, pour les navigateurs aériens, comme Atria et Avior.",
      ],
    },
  ],
  Phe: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "L'oiseau de feu est une légende d'Orient : les Égyptiens ont le Bénou, que les Grecs ont appelé phénix. Hérodote le décrit venant à Héliopolis tous les cinq cents ans ; plus tard, Ovide en fait l'oiseau qui renaît de ses cendres.",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Ankaa, alpha, vient de l'arabe al-'anqā', un oiseau légendaire du folklore arabe.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Le 5 décembre 1956, une pluie d'étoiles filantes, les Phénicides, jaillit de la constellation du Phénix ; elle est restée très rare depuis.",
      ],
    },
  ],
  Pic: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le Peintre est le chevalet et la palette du peintre ; Lacaille l'appelle d'abord le Chevalet. En latin, il écrit Equuleus pictorius, « le chevalet du peintre ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "En 1897, Jacobus Kapteyn découvre dans le Peintre une étoile très rapide, l'étoile de Kapteyn, à environ 13 années-lumière.",
        "À partir de 2008, des astronomes ont photographié dans le disque de Beta Pictoris une planète géante, Beta Pictoris b.",
      ],
    },
  ],
  Pyx: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Son nom latin, Pyxis nautica, vient du grec pyxis, « la boîte » : celle qui contenait l'aiguille de la boussole de mer.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "T Pyxidis est une nova récurrente : elle a flambé en 1890, 1902, 1920, 1944, 1967 et 2011, de la quinzième à la septième magnitude environ.",
      ],
    },
  ],
  Ret: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le Réticule est le « réticule rhomboïde », le petit quadrillage de fils en losange que Lacaille avait placé dans l'oculaire de sa lunette pour mesurer les positions. Un globe de 1621, dû à Isaac Habrecht II, montrait déjà un « Rhombus » à cet endroit.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Zeta Reticuli, à 39 années-lumière, est un couple de deux étoiles de type solaire, séparées d'une distance bien plus grande que celle entre Neptune et le Soleil.",
      ],
    },
  ],
  Scl: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le Sculpteur est l'atelier du sculpteur ; les atlas du XVIIIe siècle l'ont aussi appelé Officina sculptoria.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "En 1783, Caroline Herschel découvre, depuis l'Angleterre, une grande galaxie spirale vue par la tranche, NGC 253, la galaxie du Sculpteur. En 1937, Harlow Shapley découvre dans la même constellation une galaxie naine, satellite de la nôtre.",
        "Le Sculpteur contient le pôle sud galactique : c'est l'une des directions les plus dégagées du ciel, où l'on voit loin dans l'Univers.",
      ],
    },
  ],
  Sct: [
    {
      kind: "origines",
      text: [
        "Johannes Hevelius, brasseur et magistrat de Dantzig, nomme l'Écu de Sobieski en 1684 en l'honneur du roi de Pologne Jean III Sobieski, qui avait chassé les Ottomans devant Vienne l'année précédente. Le nom a été raccourci en Scutum au XIXe siècle.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Le Nuage d'étoiles du Scutum est l'une des plus riches régions de la Voie lactée d'été. L'amas M11, dit « du Canard sauvage », doit son nom à William Henry Smyth, qui en 1844 lui trouve la forme d'un vol de canards.",
        "UY Scuti, dans la constellation, est l'une des plus grosses étoiles connues, une hypergéante rouge.",
      ],
    },
  ],
  Sex: [
    {
      kind: "origines",
      text: [
        "Johannes Hevelius, brasseur et magistrat de Dantzig, décrit le Sextant en 1687. Son sextant, un grand instrument de laiton, lui servait à mesurer la distance angulaire entre les étoiles : il a été détruit en 1679, dans l'incendie de son observatoire.",
        "Il l'appelle Sextans Uraniae, le « sextant d'Uranie », du nom de la muse de l'astronomie.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Le Sextant est une constellation faible, au sud du Lion : sa plus brillante étoile, alpha, est de magnitude 4,5. On y a découvert en 1990 une galaxie naine, satellite de la Voie lactée.",
      ],
    },
  ],
  Tel: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le Télescope est la lunette astronomique. Il ne faut pas le confondre avec le « Télescope d'Herschel », une constellation abandonnée, voisine du Lynx.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Le Télescope est une constellation faible, au sud du Sagittaire et de la Couronne australe : sa plus brillante étoile, alpha, est de magnitude 3,5.",
      ],
    },
  ],
  TrA: [
    {
      kind: "origines",
      text: [
        KEYSER,
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Atria, alpha, n'a pas de nom ancien : c'est une contraction de « alpha Trianguli Australis », créée en 1937 par le Nautical Almanac Office britannique pour les navigateurs aériens, comme Avior et Peacock. Elle forme avec bêta et gamma un triangle presque équilatéral.",
      ],
    },
  ],
  Tuc: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Le toucan est un oiseau d'Amérique du Sud, dont le nom vient du tupi tukana.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Le Toucan abrite le Petit Nuage de Magellan, galaxie satellite de la nôtre. En 1912, en étudiant des céphéides de ce nuage, Henrietta Leavitt découvre que plus une étoile est lumineuse, plus sa période est longue : la règle qui sert à mesurer les distances dans l'Univers.",
        "L'amas globulaire 47 Tucanae, le deuxième plus brillant du ciel après Omega du Centaure, a été découvert par Lacaille en 1752, depuis le Cap.",
      ],
    },
  ],
  Vol: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Le nom latin complet est Piscis Volans, « le poisson volant ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "John Herschel, qui observe depuis le Cap entre 1834 et 1838, y découvre la galaxie NGC 2442, aux bras déformés par une rencontre.",
      ],
    },
  ],
  Vul: [
    {
      kind: "origines",
      text: [
        "Hevelius l'a publié dans son atlas posthume de 1690, sous le nom latin de Vulpecula cum ansere. L'oie a disparu des cartes, mais l'étoile alpha du Petit Renard garde son nom, Anser, « l'oie ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La nébuleuse de l'Haltère (M27) est la première nébuleuse planétaire jamais découverte : Messier la repère en 1764.",
        "En 1967, Jocelyn Bell, étudiante à Cambridge, remarque dans le Petit Renard un signal radio d'une régularité étonnante : c'est le premier pulsar, PSR B1919+21.",
        "Le Cintre, un alignement d'étoiles que les jumelles révèlent bien, est aussi appelé amas de Brocchi.",
      ],
    },
  ],
};
