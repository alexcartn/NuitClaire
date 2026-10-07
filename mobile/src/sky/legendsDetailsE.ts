import type { LegendDetail } from "./legends.ts";

/** Contextes communs aux constellations creees par un meme auteur : chaque
 * page est lue seule, donc le contexte est repete sur chacune. */
export const KEYSER =
  "Pieter Dirkszoon Keyser, pilote, et Frederick de Houtman ont mesuré, pendant la première expédition néerlandaise vers les Indes orientales (1595-1597), la position d'environ 135 étoiles du ciel austral. Keyser est mort à Java en 1596 ; Houtman a rapporté les mesures aux Pays-Bas, où le cartographe Petrus Plancius en a tiré douze constellations, placées sur un globe vers 1598, puis publiées par Johann Bayer dans son Uranometria de 1603.";

export const LACAILLE =
  "Nicolas-Louis de Lacaille, abbé et astronome français, a séjourné au cap de Bonne-Espérance de 1751 à 1753 et y a mesuré la position de près de dix mille étoiles du ciel austral. Il les a regroupées en quatorze constellations nouvelles, qu'il a nommées d'après les instruments des sciences et des arts de son siècle ; elles paraissent en 1756, puis dans son catalogue posthume de 1763.";

/** Developpements historiques, cinquieme lot : constellations modernes, de la
 * Machine pneumatique au Petit Lion. */
export const DETAILS_E: Record<string, LegendDetail[]> = {
  Ant: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "La pompe à air, mise au point au XVIIe siècle par Otto von Guericke, Robert Boyle et Denis Papin, était l'un des instruments phares de la physique expérimentale. La forme latine, Antlia pneumatica (du grec antlia, « pompe »), apparaît dans le catalogue de 1763.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La constellation est pauvre en étoiles : la plus brillante, Alpha Antliae, ne dépasse pas la magnitude 4,3. Elle abrite pourtant une galaxie très diffuse, Antlia 2, découverte en 2018 grâce aux données du satellite Gaia : presque aussi grande que le Grand Nuage de Magellan, mais si peu lumineuse qu'elle était passée inaperçue.",
      ],
    },
  ],
  Aps: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "L'oiseau de paradis venait de Nouvelle-Guinée. On n'en voyait en Europe que des peaux préparées, sans pattes, d'où la croyance qu'il vivait toujours en vol : son nom latin, Apus, veut dire « sans pied ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Constellation voisine du pôle Sud céleste, ses étoiles sont faibles : la plus brillante, Alpha Apodis, est de magnitude 3,8.",
      ],
    },
  ],
  Cae: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le Burin évoque l'art de la gravure et de la sculpture, comme son voisin le Sculpteur, que Lacaille a lui aussi créé. Le nom a été raccourci en Caelum au XIXe siècle.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "C'est l'une des constellations les plus discrètes : aucune étoile n'y est plus brillante que la magnitude 4,4, ce qui la rend difficile à repérer.",
      ],
    },
  ],
  Cam: [
    {
      kind: "origines",
      text: [
        "Petrus Plancius, né en Flandre, était pasteur calviniste avant d'être cartographe. Le nom latin de la Girafe, Camelopardalis, est celui du « chameau-léopard », la girafe des Anciens.",
        "Jakob Bartsch, le gendre de Kepler, la reprend sur sa carte de 1624 et, selon lui, elle représente le chameau qui conduisit Rébecca à Isaac, dans la Bible.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La constellation est très étendue mais ses étoiles sont faibles : la plus brillante, bêta, est de magnitude 4,0. On y trouve la « Cascade de Kemble », une chaîne d'étoiles que le frère franciscain Lucian Kemble décrit en 1980 et qui se découvre bien aux jumelles.",
      ],
    },
  ],
  CVn: [
    {
      kind: "origines",
      text: [
        "Johannes Hevelius, brasseur et magistrat de Dantzig, décrit les Chiens de chasse en 1687, avec six autres constellations encore en usage, dans son atlas posthume de 1690.",
        "Ptolémée classait ces étoiles parmi les « informes » de la Grande Ourse, c'est-à-dire celles qu'il n'avait rattachées à aucune figure.",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Cor Caroli, alpha, « le cœur de Charles », honore un roi Charles d'Angleterre, Charles Ier ou Charles II selon les récits : le nom a été donné par le médecin Charles Scarborough.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La galaxie du Tourbillon (M51), dans les Chiens de chasse, est découverte par Charles Messier en 1773. En 1845, lord Rosse y distingue des bras en spirale : c'est la première galaxie dont on reconnaisse la forme spirale.",
      ],
    },
  ],
  Cha: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Le caméléon, lézard d'Afrique et d'Asie, fait partie des animaux exotiques dont les marins ont peuplé le ciel du Sud.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Le Caméléon abrite un grand nuage de gaz et de poussière où naissent des étoiles, à moins de 700 années-lumière : l'une des régions de formation d'étoiles les plus proches de nous.",
      ],
    },
  ],
  Cir: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Les instruments de dessin et de mesure forment une petite famille dans ce coin du ciel : la Règle, voisine du Compas, est une autre création de Lacaille.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "En 1977, des astronomes australiens (Freeman, Karlsson et Rodgers) découvrent dans le Compas une galaxie active, la galaxie du Compas, cachée en partie par la poussière de la Voie lactée.",
      ],
    },
  ],
  Col: [
    {
      kind: "origines",
      text: [
        "Plancius, pasteur calviniste et cartographe d'origine flamande, cherchait à donner au ciel des figures bibliques.",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Phact, alpha, vient de l'arabe fākhita, « la tourterelle » ; Wazn, bêta, de al-wazn, « le poids ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La Colombe apparaît sur la carte de Plancius de 1592 et dans l'Uranometria de Bayer, en 1603, sous le nom de Columba Noachi, « la colombe de Noé ».",
      ],
    },
  ],
  Cru: [
    {
      kind: "origines",
      text: [
        "Dante décrit, dans le Purgatoire (vers 1310), « quatre étoiles jamais vues, sauf des premiers hommes », que l'on a rapprochées de la Croix du Sud. En 1501, Amerigo Vespucci en parle dans ses lettres ; Andrea Corsali la décrit avec précision vers 1515.",
        "Pour les Aborigènes d'Australie, la tache sombre voisine, le Sac à charbon, est la tête d'un émeu. Pour les Māori, la Croix du Sud est parfois « l'ancre » (Te Punga).",
        "Petrus Plancius, pasteur calviniste et cartographe d'origine flamande, en fait une constellation à part vers 1600.",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Acrux et Gacrux n'ont pas de nom ancien : ce sont des contractions modernes de « Alpha Crucis » et de « Gamma Crucis ». Le Sac à charbon est une nébuleuse sombre, si dense qu'elle cache les étoiles de la Voie lactée.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La Croix du Sud est la plus petite des 88 constellations, mais elle figure sur de nombreux drapeaux, dont ceux de l'Australie, de la Nouvelle-Zélande, du Brésil, de la Papouasie-Nouvelle-Guinée et de Samoa.",
        "Près de Beta Crucis, l'amas de la Boîte à bijoux (NGC 4755) a été découvert par Lacaille en 1752 depuis le Cap, et ainsi nommé par John Herschel.",
      ],
    },
  ],
  Dor: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Elle a aussi été appelée Xiphias, l'« espadon ».",
      ],
    },
    {
      kind: "histoire",
      text: [
        "La Dorade abrite l'essentiel du Grand Nuage de Magellan, avec la nébuleuse de la Tarentule, la plus grande région de formation d'étoiles connue du Groupe local. C'est dans ce nuage qu'éclate, le 23 février 1987, la supernova SN 1987A, la plus proche depuis celle de Kepler en 1604.",
        "Les nuages de Magellan doivent leur nom à Fernand de Magellan : son chroniqueur, Antonio Pigafetta, les décrit lors du tour du monde de 1519-1522.",
      ],
    },
  ],
  For: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "Le Fourneau est le four du chimiste, que Lacaille nomme en latin Fornax chemica : un instrument de la chimie naissante du XVIIIe siècle.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "En 1938, Harlow Shapley découvre dans le Fourneau une galaxie naine, très faible, satellite de la Voie lactée.",
        "En 2003-2004, le télescope spatial Hubble a pointé un petit coin de ciel du Fourneau, pendant plus d'un million de secondes de pose : c'est le « Hubble Ultra Deep Field », qui montre des galaxies parmi les plus lointaines connues à l'époque.",
      ],
    },
  ],
  Gru: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Dans l'Antiquité, les étoiles de la Grue faisaient partie de la queue du Poisson austral ; Bayer en fait en 1603 une constellation à part.",
      ],
    },
    {
      kind: "etoiles",
      text: [
        "Alnair, alpha, vient de l'arabe al-nayyir, « la brillante », nom qu'elle portait à l'époque où elle appartenait au Poisson austral.",
      ],
    },
  ],
  Hor: [
    {
      kind: "origines",
      text: [
        LACAILLE,
        "L'Horloge rend hommage à l'horloge à pendule, inventée par Christiaan Huygens en 1656. Pour mesurer l'ascension droite d'une étoile, les astronomes notaient l'instant de son passage au méridien : une bonne horloge leur était indispensable.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Constellation discrète, en forme de zigzag, entre Achernar et le Réticule : ses étoiles sont faibles et sa figure est difficile à tracer.",
      ],
    },
  ],
  Hyi: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "Son nom la distingue de l'Hydre, la constellation antique, aussi appelée Hydre femelle : l'Hydre mâle est un petit serpent d'eau, voisin d'Achernar et du pôle Sud céleste.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Beta Hydri, à 24 années-lumière, est une étoile proche qui ressemble au Soleil, mais plus âgée : les astronomes l'étudient pour imaginer l'avenir de notre étoile.",
      ],
    },
  ],
  Ind: [
    {
      kind: "origines",
      text: [
        KEYSER,
        "L'Indien est un personnage tenant des flèches, sans plus de précision sur son peuple : les navigateurs néerlandais visitaient les Indes orientales, mais le mot servait aussi pour les autochtones d'Amérique.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "Epsilon Indi, à 11,9 années-lumière, est l'une des étoiles les plus proches du Soleil. Elle est accompagnée de deux naines brunes, découvertes en 2003, et d'une planète géante, photographiée directement par le télescope spatial James Webb en 2024.",
      ],
    },
  ],
  Lac: [
    {
      kind: "origines",
      text: [
        "Johannes Hevelius, brasseur et magistrat de Dantzig, a publié le Lézard dans son atlas posthume de 1690, avec six autres constellations encore en usage. Il l'appelle Lacerta, « le lézard », aussi nommé Stellio, nom latin d'un lézard tacheté.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "BL Lacertae, d'abord prise pour une étoile variable, a été découverte en 1929 par Cuno Hoffmeister. En 1968, on y reconnaît un noyau de galaxie actif, aux variations très rapides : BL Lac donne son nom à toute une famille d'objets, les « BL Lac ».",
      ],
    },
  ],
  LMi: [
    {
      kind: "origines",
      text: [
        "Johannes Hevelius, brasseur et magistrat de Dantzig, décrit le Petit Lion en 1687, avec six autres constellations encore en usage, dans son atlas posthume de 1690. Il rassemble des étoiles faibles que Ptolémée avait laissées en dehors de toute figure, entre la Grande Ourse et le Lion.",
      ],
    },
    {
      kind: "histoire",
      text: [
        "En 2007, une enseignante néerlandaise, Hanny van Arkel, qui participait au projet de science participative Galaxy Zoo, repère dans le Petit Lion un objet verdâtre étrange, depuis connu comme « l'objet de Hanny » : un nuage de gaz éclairé par un noyau de galaxie dont l'activité s'est éteinte.",
      ],
    },
  ],
};
