import type { LegendDetail } from "./legends.ts";

/** Les trois modeles : Orion, Cassiopee, Lynx. */
export const DETAILS_MODELS: Record<string, LegendDetail[]> = {
  Ori: [
      {
        kind: "origines",
        text: [
          "La figure du chasseur est l'une des plus anciennes du ciel. Les Mésopotamiens y voyaient le « Vrai Berger d'Anu » (Sipazianna) ; les Égyptiens, le dieu Sah, identifié à Osiris, qui avait pour compagne Sopdet, c'est-à-dire Sirius, identifiée à Isis.",
          "En Chine, les trois étoiles du baudrier forment Shen, l'une des vingt-huit demeures de la Lune, et Antarès s'appelle Shang. Comme Orion et le Scorpion, ces deux astres ne se montrent jamais ensemble : une tradition chinoise en a fait deux frères brouillés, condamnés à ne jamais se rencontrer.",
          "Chez les Grecs, Orion apparaît déjà chez Homère. Dans l'Odyssée, Ulysse l'aperçoit aux Enfers, chassant encore parmi les ombres ; l'Iliade le place sur le bouclier d'Achille. Hésiode se sert de son lever et de son coucher pour rythmer les travaux des champs.",
          "Sa naissance donne lieu à une histoire étrange. Selon Ovide, trois dieux (Zeus, Poséidon et Hermès), reçus par le paysan Hyriée, urinent sur la peau d'un bœuf qu'il leur avait sacrifié ; neuf mois plus tard, Orion en naît. Les Grecs rapprochaient son nom du mot ouron, « urine » : une étymologie populaire plus qu'une certitude.",
          "D'autres épisodes complètent le récit. Aveuglé par le roi Oenopion de Chios pour avoir violé sa fille Mérope, Orion marche vers l'est et retrouve la vue aux rayons d'Hélios. Il poursuit aussi les Pléiades, les sept filles d'Atlas, que Zeus change en étoiles pour les sauver : c'est pourquoi Orion semble courir derrière elles à travers le ciel.",
        ],
      },
      {
        kind: "etoiles",
        text: [
          "Bételgeuse, à l'épaule droite d'Orion, vient de l'arabe yad al-jawzā', « la main d'al-Jawzā' », ancien nom arabe de la constellation ; le mot s'est déformé au fil des copies médiévales. Rigel, au pied gauche, vient de rijl, « le pied ».",
          "Bellatrix, à l'épaule gauche, est un nom latin : « la guerrière ». Saiph, au genou droit, vient de l'arabe saif, « l'épée ». Le baudrier garde trois noms arabes : Alnitak, « la ceinture », Alnilam, « le collier de perles », et Mintaka, « le ceinturon ».",
          "Bételgeuse est une supergéante rouge dont l'éclat varie, Rigel une supergéante bleue, bien plus chaude : deux étoiles très différentes, à plusieurs centaines d'années-lumière de nous, qui encadrent le baudrier.",
          "En France, le baudrier a longtemps été appelé les Trois Rois ou les Trois Mages ; en espagnol, Las Tres Marías.",
        ],
      },
      {
        kind: "histoire",
        text: [
          "Orion fait partie des 48 constellations de l'Almageste de Ptolémée (IIe siècle), qui lui compte 38 étoiles. Au Xe siècle, l'astronome persan Al-Sufi reprend le catalogue de Ptolémée dans son Livre des étoiles fixes, avec les noms arabes alors en usage et un dessin de chaque figure.",
          "En 1603, Johann Bayer note les étoiles avec des lettres grecques dans son Uranometria. Il appelle Bételgeuse « alpha » et Rigel « bêta », alors que Rigel est le plus souvent la plus brillante des deux : Bételgeuse étant variable, l'ordre de Bayer ne suit pas toujours l'éclat du moment.",
          "La grande nébuleuse d'Orion, visible à l'œil nu sous le baudrier, est l'une des premières nébuleuses décrites à la lunette : Nicolas-Claude Fabri de Peiresc l'observe en 1610, peu après l'invention de l'instrument. Charles Messier la range dans son catalogue en 1771 sous le numéro 42 ; c'est aujourd'hui l'une des cibles favorites de l'astrophotographie.",
          "En 1922, l'Union astronomique internationale retient 88 constellations officielles, et en 1930 le Belge Eugène Delporte en trace les frontières. Orion y garde son nom latin et son abréviation, Ori.",
        ],
      },
  ],
  Cas: [
      {
        kind: "origines",
        text: [
          "Pour les Grecs, Cassiopée est la reine d'Éthiopie, mais le lieu de l'épisode varie. Certains auteurs le situent à Joppé (Jaffa), sur la côte du Levant, où l'on montrait les chaînes d'Andromède ; Pline l'Ancien rapporte que l'édile Marcus Aemilius Scaurus fit exposer à Rome, en 58 avant notre ère, les ossements du monstre marin venus de cette ville.",
          "L'histoire a inspiré le théâtre athénien : Sophocle et Euripide ont tous deux écrit une tragédie intitulée Andromède, aujourd'hui perdue, au Ve siècle avant notre ère.",
          "Les astronomes arabes y voyaient « la main teinte » (al-kaff al-khaḍīb) : une main colorée de henné, que dessine le W d'étoiles.",
        ],
      },
      {
        kind: "etoiles",
        text: [
          "Schedar, l'étoile alpha, vient de l'arabe al-ṣadr, « la poitrine » ; Caph, bêta, de kaff, « la main », et Ruchbah, delta, de rukba, « le genou ». Ces noms désignent les parties du corps de la reine assise sur son trône.",
          "Gamma Cassiopeiae, au centre du W, est connue sous le nom de Navi. Il vient de l'astronaute américain Gus Grissom, dont le second prénom, Ivan, lu à l'envers, donne Navi : un clin d'œil qu'il aurait utilisé à bord. L'Union astronomique internationale l'a adopté officiellement en 2016.",
        ],
      },
      {
        kind: "histoire",
        text: [
          "L'Almageste de Ptolémée (IIe siècle) attribue 13 étoiles à Cassiopée.",
          "Le 11 novembre 1572, le jeune astronome danois Tycho Brahe remarque dans Cassiopée une « étoile nouvelle » aussi brillante que Vénus. Il montre qu'elle ne bouge pas par rapport aux autres étoiles : elle n'appartient donc pas à l'atmosphère, comme le voulait Aristote, mais au monde des étoiles fixes, qu'on croyait immuable.",
          "Son livre De nova stella (1573) compte parmi les jalons de l'astronomie moderne ; on sait aujourd'hui que l'astre était une supernova. Cassiopée sert aussi de repère pour trouver l'étoile Polaire, de l'autre côté du pôle par rapport à la Grande Ourse.",
        ],
      },
  ],
  Lyn: [
      {
        kind: "origines",
        text: [
          "Johannes Hevelius (Jan Heweliusz), brasseur et magistrat de Dantzig, était aussi l'un des meilleurs observateurs du XVIIe siècle. Il a créé sept constellations encore en usage : les Chiens de chasse, le Lézard, le Petit Lion, le Lynx, l'Écu de Sobieski, le Sextant et le Petit Renard.",
          "Le Lynx remplit un grand espace du ciel du Nord sans étoile brillante, entre le Cocher, les Gémeaux, le Cancer, le Petit Lion, la Grande Ourse et la Girafe. Depuis l'Antiquité, le lynx passe pour l'animal à la vue la plus perçante : le héros Lyncée, l'un des Argonautes, était réputé pour la sienne.",
        ],
      },
      {
        kind: "histoire",
        text: [
          "Hevelius observait à l'œil nu : il refusait les lunettes de visée que ses contemporains jugeaient indispensables pour mesurer les positions. Cela a donné lieu à une querelle avec Robert Hooke. En 1679, le jeune Edmond Halley a fait le voyage jusqu'à Dantzig, a contrôlé ses mesures et les a trouvées d'une exactitude remarquable.",
          "Hevelius est mort en 1687 ; son atlas, le Firmamentum Sobiescianum, a paru en 1690. Sa seconde épouse, Elisabeth, qui l'aidait à observer, a fait publier ses ouvrages après sa mort.",
          "La planche du Lynx du Miroir d'Uranie (1824), qui illustre cette page, le montre avec le Télescope d'Herschel, une constellation abandonnée créée en 1781 par l'astronome Maximilian Hell pour honorer William Herschel, qui venait de découvrir Uranus.",
        ],
      },
  ],
};
