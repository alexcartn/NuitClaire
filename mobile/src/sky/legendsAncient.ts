import type { Legend } from "./legends.ts";

/** Les constellations qui ont un recit antique (celles de Ptolemee, la
 * Chevelure de Berenice et les trois morceaux du navire Argo). Le recit donne
 * est le plus repandu ; les variantes importantes sont signalees. */
export const LEGENDS_ANCIENT: Record<string, Legend> = {
  And: {
    origin: "antique",
    tagline: "La princesse enchaînée",
    text: [
      "Andromède est la fille de Céphée et de Cassiopée, souverains d'Éthiopie. Pour apaiser Poséidon, offensé par la vanité de sa mère, elle est enchaînée à un rocher en offrande à un monstre marin.",
      "Persée, de retour de sa victoire sur la Méduse, la voit, la délivre et l'épouse. Après sa mort, Athéna la place parmi les étoiles.",
      "Toute la famille partage le même coin de ciel : Cassiopée, Céphée, Persée et le monstre, la Baleine.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin (L'Astronomie poétique).",
    plate: "and",
  },
  Aql: {
    origin: "antique",
    tagline: "L'aigle de Zeus",
    text: [
      "L'Aigle est l'oiseau de Zeus, celui qui porte sa foudre. Dans plusieurs récits, il enlève le jeune Ganymède, un Troyen d'une grande beauté, pour en faire l'échanson des dieux de l'Olympe.",
      "Zeus l'a placé au ciel en récompense de ses services. Le Verseau, tout proche, est souvent identifié à Ganymède lui-même.",
      "Son étoile principale, Altaïr, forme avec Véga et Deneb le triangle d'été.",
    ],
    source: "Récit résumé d'après Ératosthène (Catastérismes) et Hygin.",
    plate: "del",
  },
  Aqr: {
    origin: "antique",
    tagline: "Celui qui verse l'eau",
    text: [
      "Le Verseau est le plus souvent identifié à Ganymède, l'échanson des dieux, qui verse le nectar de son vase. Une autre tradition y voit Deucalion, le héros du Déluge dans la mythologie grecque.",
      "L'image d'un personnage qui verse de l'eau est très ancienne : on la retrouve en Mésopotamie, bien avant les Grecs.",
      "Le ciel voisin est celui de l'eau : Poissons, Baleine, Éridan, et le Capricorne, mi-chèvre mi-poisson.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "aqr",
  },
  Ara: {
    origin: "antique",
    tagline: "L'autel des dieux",
    text: [
      "L'Autel est celui sur lequel les dieux de l'Olympe jurèrent alliance avant d'affronter les Titans. Zeus l'a ensuite élevé au ciel, pour que ce serment reste présent à tous les yeux.",
      "Il se trouve au sud du Scorpion, dans une région de la Voie lactée très riche en amas d'étoiles.",
    ],
    source: "Récit résumé d'après Ératosthène (Catastérismes) et Hygin.",
  },
  Ari: {
    origin: "antique",
    tagline: "Le bélier à la toison d'or",
    text: [
      "Le Bélier est celui de la toison d'or. Envoyé par Hermès, il emporte dans les airs Phrixos et sa sœur Hellé pour les sauver d'un sacrifice. Hellé tombe en route dans le détroit qui s'appellera l'Hellespont.",
      "Phrixos arrive en Colchide, sacrifie le bélier à Zeus et offre sa toison au roi. C'est cette toison que Jason ira chercher avec les Argonautes ; le bélier, lui, est placé parmi les étoiles.",
    ],
    source: "Récit résumé d'après Hygin et Ovide (Les Fastes).",
    plate: "ari",
  },
  Aur: {
    origin: "antique",
    tagline: "Le conducteur de char",
    text: [
      "Le Cocher passe le plus souvent pour Érichthonios, roi d'Athènes, infirme des jambes, qui inventa le char attelé de quatre chevaux. D'autres y voient Myrtilos, le cocher du roi Oenomaos.",
      "Sur son épaule brille Capella, la « petite chèvre », que l'on rattache à Amalthée, la chèvre qui nourrit Zeus enfant.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "aur",
  },
  Boo: {
    origin: "antique",
    tagline: "Le gardien de l'Ourse",
    text: [
      "Son nom signifie « conducteur de bœufs » : on le voit aux trousses de la Grande Ourse, comme un bouvier qui mène ses bêtes autour du pôle. Arcturus, son étoile principale, veut dire « le gardien de l'Ourse ».",
      "Les récits varient : on y voit le plus souvent Arcas, fils de Callisto et de Zeus, qui chassait sa propre mère changée en ourse ; ou Icarios, à qui Dionysos apprit à faire le vin et que des bergers ivres tuèrent.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "boo",
  },
  Cnc: {
    origin: "antique",
    tagline: "Le crabe d'Héra",
    text: [
      "Pendant qu'Héraclès combat l'Hydre de Lerne, Héra envoie un crabe lui pincer le pied pour le distraire. Le héros l'écrase d'un coup de talon.",
      "Héra, pour le remercier de ce service, place le crabe parmi les étoiles. La constellation est discrète, mais elle abrite l'amas de la Crèche (M44), visible à l'œil nu sous un ciel noir.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "cnc",
  },
  CMa: {
    origin: "antique",
    tagline: "Le chien d'Orion",
    text: [
      "Le Grand Chien est le plus souvent le chien d'Orion, qui le suit à la chasse sur la piste du Lièvre. Dans une autre version, c'est Laelaps, le chien qui ne manquait aucune proie, offert par Zeus à Europe.",
      "Il porte Sirius, l'étoile la plus brillante du ciel. Les Grecs l'appelaient la « Brûlante » : les jours où elle se levait avec le Soleil, en plein été, ont donné les « canicules ».",
    ],
    source: "Récit résumé d'après Hygin.",
    plate: "cma",
  },
  CMi: {
    origin: "antique",
    tagline: "Le second chien",
    text: [
      "Le Petit Chien est le second chien d'Orion, ou, dans une autre version, Maera, la chienne d'Icarios. Après l'assassinat de son maître, elle mena sa fille Érigone jusqu'à son corps ; Érigone se pendit de chagrin, et Zeus plaça le chien, la jeune fille et son père dans le ciel.",
      "Procyon, son étoile principale, signifie « avant le chien » : elle se lève juste avant Sirius.",
    ],
    source: "Récit résumé d'après Hygin.",
    plate: "mon",
  },
  Cap: {
    origin: "antique",
    tagline: "La chèvre à queue de poisson",
    text: [
      "Le Capricorne a le corps d'une chèvre et la queue d'un poisson. Selon Ératosthène et Hygin, c'est Pan : quand le monstre Typhon attaque les dieux, Pan se jette dans le Nil ; la partie immergée de son corps prend une queue de poisson.",
      "Une autre tradition y voit Amalthée, la chèvre qui nourrit Zeus, ou son fils Égipan. L'image est bien plus ancienne : les Mésopotamiens figuraient déjà une chèvre-poisson.",
    ],
    source: "Récit résumé d'après Ératosthène et Hygin.",
    plate: "cap",
  },
  Cen: {
    origin: "antique",
    tagline: "Le sage centaure",
    text: [
      "Le Centaure est le plus souvent Chiron, le plus sage des centaures, précepteur d'Achille, d'Asclépios et de Jason. Blessé par une flèche empoisonnée d'Héraclès, il cède son immortalité à Prométhée, et Zeus le place au ciel.",
      "Il tient une bête, le Loup, qu'il s'apprête à offrir en sacrifice sur l'Autel voisin.",
      "Alpha du Centaure, à 4,4 années-lumière, est le système d'étoiles le plus proche du Soleil.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "hya",
  },
  Cep: {
    origin: "antique",
    tagline: "Le roi d'Éthiopie",
    text: [
      "Céphée est le roi d'Éthiopie, époux de Cassiopée et père d'Andromède. Quand le monstre marin ravage son royaume, c'est lui qui doit se résoudre à lui livrer sa fille.",
      "Persée la sauve et l'épouse, mais Phinée, à qui elle avait été promise, vient troubler la fête et finit pétrifié par la tête de la Méduse. Après sa mort, Céphée rejoint les étoiles avec toute sa famille.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin.",
    plate: "cep",
  },
  Cet: {
    origin: "antique",
    tagline: "Le monstre marin",
    text: [
      "Malgré son nom, ce n'est pas une baleine : c'est Cétus, le monstre marin que Poséidon envoie dévaster l'Éthiopie après la vantardise de Cassiopée.",
      "Persée le tue (ou le pétrifie avec la tête de la Méduse, selon les versions), et le monstre rejoint le ciel, sous les pieds de la famille royale.",
      "Mira, son étoile variable, passe en onze mois environ de la visibilité à l'œil nu à l'invisibilité : son nom signifie « l'étonnante ».",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin.",
    plate: "eri",
  },
  CrA: {
    origin: "antique",
    tagline: "La couronne du Sagittaire",
    text: [
      "Peu d'histoires se rattachent à la Couronne australe : les Anciens y voyaient une couronne de feuillage tombée aux pieds du Sagittaire, ou celle qu'il porte lui-même. Aucun récit ne s'impose.",
      "Son arc d'étoiles se reconnaît bien sous un ciel sombre, tout près de la Voie lactée.",
    ],
    source: "Constellation décrite par Ptolémée (IIe siècle) ; récits anciens peu nombreux.",
    plate: "sgr",
  },
  CrB: {
    origin: "antique",
    tagline: "La couronne d'Ariane",
    text: [
      "La Couronne boréale est celle que Dionysos offre à Ariane, fille du roi Minos, abandonnée par Thésée sur l'île de Naxos. Le dieu l'épouse et jette sa couronne au ciel, où ses pierres deviennent des étoiles.",
      "Son demi-cercle presque parfait se repère facilement près d'Arcturus. L'étoile la plus brillante, Gemma, est la « perle » de la couronne.",
    ],
    source: "Récit résumé d'après Ovide (Les Fastes) et Hygin.",
    plate: "her",
  },
  Crv: {
    origin: "antique",
    tagline: "Le corbeau d'Apollon",
    text: [
      "Apollon envoie son corbeau chercher de l'eau avec une coupe. L'oiseau s'attarde près d'un figuier dont les fruits ne sont pas mûrs, attend qu'ils le soient, puis rapporte un serpent d'eau en prétendant qu'il l'a retenu.",
      "Apollon, qui n'est pas dupe, le punit : il le place au ciel avec la Coupe et l'Hydre, et le condamne à la soif, car le serpent l'empêche d'atteindre la coupe.",
    ],
    source: "Récit résumé d'après Ovide (Les Fastes) et Hygin.",
    plate: "hya",
  },
  Crt: {
    origin: "antique",
    tagline: "La coupe du corbeau",
    text: [
      "La Coupe est celle que le Corbeau devait remplir d'eau pour Apollon. Placée au ciel avec lui, elle reste hors de sa portée : l'Hydre, enroulée sous les deux constellations, l'en sépare.",
      "Les trois occupent le même coin de ciel, au sud du Lion et de la Vierge.",
    ],
    source: "Récit résumé d'après Ovide (Les Fastes) et Hygin.",
    plate: "hya",
  },
  Cyg: {
    origin: "antique",
    tagline: "Le cygne de Zeus",
    text: [
      "Plusieurs récits se croisent. Le plus connu : Zeus, épris de Léda, prend la forme d'un cygne pour la séduire ; de cette union naissent Hélène de Troie et, selon les versions, Castor et Pollux, les Gémeaux.",
      "Une autre version y voit Cycnus, parent de Phaéton, qui pleurait sa mort au bord de l'Éridan et fut changé en cygne.",
      "On l'appelle aussi la Croix du Nord : elle suit la Voie lactée, et Deneb marque sa queue.",
    ],
    source: "Récit résumé d'après Hygin et Ovide (Les Métamorphoses).",
    plate: "lyr",
  },
  Del: {
    origin: "antique",
    tagline: "Le dauphin de Poséidon",
    text: [
      "Le Dauphin est celui qui retrouva Amphitrite, la nymphe qui avait fui le mariage avec Poséidon, et la convainquit d'épouser le dieu. En récompense, Poséidon le plaça parmi les étoiles.",
      "Une autre version y voit le dauphin qui sauva le poète Arion : jeté à la mer par des marins qui voulaient le dépouiller, il fut porté jusqu'au rivage sur le dos de l'animal.",
      "Petit et compact, il se repère à son losange d'étoiles, près de l'Aigle et de la Flèche.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "del",
  },
  Dra: {
    origin: "antique",
    tagline: "Le gardien des pommes d'or",
    text: [
      "Le Dragon est Ladon, le monstre qui garde les pommes d'or du jardin des Hespérides. Héraclès le tue lors de l'un de ses travaux, et Héra place le dragon parmi les étoiles.",
      "Dans une autre version, c'est le dragon qu'Athéna aurait jeté dans le ciel pendant la guerre des Géants : il s'est enroulé autour du pôle.",
      "Thuban, l'une de ses étoiles, était l'étoile polaire il y a environ 4 700 ans, à l'époque des premières pyramides d'Égypte.",
    ],
    source: "Récit résumé d'après Hygin et Apollodore.",
    plate: "dra",
  },
  Equ: {
    origin: "antique",
    tagline: "Le petit cheval",
    text: [
      "Les récits sont rares et contradictoires : on y a vu Celeris, le cheval offert par Hermès à Castor, ou Hippé, fille du centaure Chiron, changée en jument.",
      "C'est la deuxième plus petite constellation du ciel, après la Croix du Sud.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "peg",
  },
  Eri: {
    origin: "antique",
    tagline: "Le fleuve de Phaéton",
    text: [
      "L'Éridan est le fleuve où tombe Phaéton, fils d'Hélios. Il avait obtenu de conduire le char du Soleil, mais les chevaux s'emballent ; pour sauver la Terre en feu, Zeus le foudroie, et il s'abîme dans le fleuve.",
      "Ses sœurs, les Héliades, le pleurent au bord de l'eau et sont changées en peupliers ; leurs larmes deviennent de l'ambre.",
      "Le fleuve céleste serpente sur une grande partie du ciel jusqu'à Achernar, « la fin du fleuve », l'une des étoiles les plus brillantes du ciel austral.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin.",
    plate: "eri",
  },
  Gem: {
    origin: "antique",
    tagline: "Castor et Pollux",
    text: [
      "Castor et Pollux, les Dioscures, sont frères jumeaux : Pollux, fils de Zeus, est immortel, alors que Castor, fils du mortel Tyndare, ne l'est pas.",
      "Quand Castor est tué, Pollux supplie Zeus de partager avec lui son immortalité. Les deux frères vivent alors tour à tour parmi les morts et sur l'Olympe, et Zeus les place au ciel.",
      "Les marins les tenaient pour leurs protecteurs : les feux de Saint-Elme, qui courent sur les mâts pendant l'orage, étaient pour eux le signe de leur présence.",
    ],
    source: "Récit résumé d'après Hygin et Ovide (Les Fastes).",
    plate: "gem",
  },
  Her: {
    origin: "antique",
    tagline: "Le héros agenouillé",
    text: [
      "Chez les Grecs, cette silhouette agenouillée n'avait pas de nom : Aratos l'appelle Engonasin, « l'homme à genoux », sans savoir qui il est.",
      "On y a ensuite reconnu Héraclès, dont le pied est posé près de la tête du Dragon qu'il combat, et Zeus le place au ciel en l'honneur de ses travaux.",
    ],
    source: "Récit résumé d'après Aratos (Les Phénomènes) et Hygin.",
    plate: "her",
  },
  Hya: {
    origin: "antique",
    tagline: "Le plus long serpent du ciel",
    text: [
      "L'Hydre est la plus grande des 88 constellations : un serpent d'eau qui s'étire sur plus de cent degrés de ciel.",
      "On y voit l'Hydre de Lerne, tuée par Héraclès, ou le serpent d'eau que le Corbeau d'Apollon a rapporté pour excuser son retard. Elle partage son coin de ciel avec le Corbeau et la Coupe.",
    ],
    source: "Récit résumé d'après Hygin et Ovide (Les Fastes).",
    plate: "hya",
  },
  Leo: {
    origin: "antique",
    tagline: "Le lion de Némée",
    text: [
      "Le Lion est celui de Némée, monstre à la peau invulnérable. Héraclès, dont c'est le premier travail, l'étrangle à mains nues après que ses flèches ont rebondi, puis le dépouille avec ses propres griffes.",
      "Zeus le place au ciel. Régulus, son étoile principale, signifie « le petit roi » : elle marque son cœur.",
      "Au printemps, il se reconnaît à sa tête en forme de faucille et à sa queue triangulaire.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "leo",
  },
  Lep: {
    origin: "antique",
    tagline: "Le lièvre d'Orion",
    text: [
      "Le Lièvre est la proie d'Orion : il fuit sous ses pieds, poursuivi par le Grand Chien. On dit qu'Hermès l'a placé au ciel parce que c'est l'animal le plus rapide.",
      "Dans le ciel d'hiver, il se tapit sous les pieds d'Orion, et sa figure se repère à un quadrilatère d'étoiles.",
    ],
    source: "Récit résumé d'après Hygin.",
    plate: "cma",
  },
  Lib: {
    origin: "antique",
    tagline: "La balance de la justice",
    text: [
      "La Balance est celle d'Astrée, déesse de la justice, que les Grecs voient dans la constellation voisine de la Vierge. Elle pèse le bien et le mal des hommes avant de quitter la Terre quand l'âge d'or s'achève.",
      "À l'origine, ses étoiles formaient les pinces du Scorpion, que les Grecs appelaient Chélai. Ce sont les Romains qui en ont fait une balance.",
      "C'est la seule constellation du zodiaque qui représente un objet et non un être vivant.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "lib",
  },
  Lup: {
    origin: "antique",
    tagline: "La bête du Centaure",
    text: [
      "Chez les Grecs, le Loup n'était qu'une « bête » (thérion) que le Centaure tient au bout de sa lance, prête à être offerte en sacrifice sur l'Autel voisin.",
      "Les Latins y ont vu un loup, et certains y ont reconnu Lycaon, roi d'Arcadie, que Zeus changea en loup pour avoir servi de la chair humaine à sa table.",
    ],
    source: "Récit résumé d'après Ératosthène et Hygin.",
    plate: "hya",
  },
  Lyr: {
    origin: "antique",
    tagline: "La lyre d'Orphée",
    text: [
      "La Lyre est celle d'Orphée, fils d'Apollon et de la muse Calliope, dont la musique charmait les bêtes, les arbres et les pierres. Quand il descendit aux Enfers pour reprendre Eurydice, elle apaisa même Hadès.",
      "Orphée est mis en pièces par des Ménades ; les Muses recueillent sa lyre et Zeus la place au ciel. Selon une autre version, c'est la toute première lyre, fabriquée par Hermès avec une carapace de tortue et offerte à Apollon.",
      "Véga, sa brillante étoile, est la cinquième du ciel par l'éclat et forme le triangle d'été avec Deneb et Altaïr.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses), Hygin et Ératosthène.",
    plate: "lyr",
  },
  Oph: {
    origin: "antique",
    tagline: "L'homme au serpent",
    text: [
      "Ophiuchus est Asclépios (Esculape), le dieu de la médecine, qui tient le Serpent. Fils d'Apollon, il apprit son art du centaure Chiron et devint si habile qu'il ressuscitait les morts.",
      "Hadès se plaint à Zeus, qui foudroie Asclépios pour rétablir l'ordre naturel. Apollon, en deuil, obtient que son fils soit placé parmi les étoiles.",
      "Le Soleil traverse sa constellation de la fin novembre à la mi-décembre : c'est le « treizième signe » du zodiaque, que l'astrologie ignore.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "oph",
  },
  Peg: {
    origin: "antique",
    tagline: "Le cheval ailé",
    text: [
      "Pégase est le cheval ailé né du sang de la Méduse, décapitée par Persée. Dompté par Bellérophon avec la bride d'or d'Athéna, il l'aide à vaincre la Chimère.",
      "Bellérophon, enhardi, tente de monter jusqu'à l'Olympe ; Zeus envoie un taon qui pique Pégase, et le héros est désarçonné. Le cheval, lui, est accueilli sur l'Olympe, où il porte la foudre de Zeus, avant d'être placé au ciel.",
      "Son grand carré sert de repère dans le ciel d'automne.",
    ],
    source: "Récit résumé d'après Hésiode (Théogonie) et Hygin.",
    plate: "peg",
  },
  Per: {
    origin: "antique",
    tagline: "Le vainqueur de la Méduse",
    text: [
      "Persée, fils de Zeus et de Danaé, reçoit des dieux des sandales ailées, un casque d'invisibilité et une faucille ; avec le bouclier poli d'Athéna, il décapite la Méduse sans croiser son regard.",
      "Du sang de la Gorgone naît Pégase. Au retour, il délivre Andromède et l'épouse.",
      "Dans le ciel, il tient la tête de la Méduse, où brille Algol, l'« étoile du démon » : environ tous les trois jours, elle s'affaiblit pendant une dizaine d'heures, car c'est une étoile double dont l'une des composantes éclipse l'autre.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin.",
    plate: "per",
  },
  Psc: {
    origin: "antique",
    tagline: "Les poissons d'Aphrodite",
    text: [
      "Les deux Poissons sont Aphrodite et son fils Éros qui, fuyant le monstre Typhon, se jettent dans l'eau sous la forme de poissons, reliés par un cordon pour ne pas se perdre.",
      "Le cordon se voit sur le ciel : une longue ligne brisée dont le nœud est l'étoile Alrescha, « la corde ».",
      "Le point vernal, où le Soleil se trouve à l'équinoxe de printemps, est dans les Poissons depuis plus de 2 000 ans : la précession des équinoxes l'a fait quitter le Bélier.",
    ],
    source: "Récit résumé d'après Ovide (Les Fastes) et Hygin.",
    plate: "psc",
  },
  PsA: {
    origin: "antique",
    tagline: "Le grand poisson du Verseau",
    text: [
      "Le Poisson austral boit l'eau que verse le Verseau. Les Grecs y voyaient le « grand poisson » dont seraient nés les deux Poissons du zodiaque.",
      "Fomalhaut, son étoile principale, signifie « la bouche du poisson » : isolée dans un coin de ciel sans autre étoile brillante, on la surnomme « la solitaire de l'automne ».",
    ],
    source: "Récit résumé d'après Ératosthène et Hygin.",
    plate: "aqr",
  },
  Sge: {
    origin: "antique",
    tagline: "La flèche",
    text: [
      "Plusieurs histoires, aucune certaine : la flèche d'Héraclès qui tua l'aigle rongeant le foie de Prométhée, celle d'Apollon qui frappa les Cyclopes, ou celle d'Éros.",
      "C'est l'une des plus petites constellations, mais sa forme de flèche est nette, entre l'Aigle et le Cygne.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "del",
  },
  Sgr: {
    origin: "antique",
    tagline: "L'archer",
    text: [
      "Le Sagittaire est un archer à corps de cheval. Selon Ératosthène, c'est Crotos, fils d'Euphémé, la nourrice des Muses, qui inventa le tir à l'arc ; les Muses obtinrent de Zeus de le placer au ciel.",
      "Il vise le cœur du Scorpion, Antarès. Dans cette direction se trouve le centre de notre galaxie : les nuages de la Voie lactée y sont les plus denses.",
    ],
    source: "Récit résumé d'après Ératosthène et Hygin.",
    plate: "sgr",
  },
  Sco: {
    origin: "antique",
    tagline: "L'ennemi d'Orion",
    text: [
      "Le Scorpion est celui que Gaïa envoie pour tuer Orion, le chasseur trop fier. Après sa mort, il est placé de l'autre côté de la voûte : Orion se couche quand il se lève.",
      "Antarès, son cœur rouge, signifie « rival de Mars » (Arès) : elle est rouge, comme la planète.",
      "Les Grecs lui donnaient de grandes pinces, que les Romains ont détachées pour former la Balance.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "sco",
  },
  Ser: {
    origin: "antique",
    tagline: "Le serpent d'Asclépios",
    text: [
      "Le Serpent est celui qu'Ophiuchus tient dans ses mains. Selon la tradition, Asclépios, ayant tué un serpent, en vit un second apporter une herbe qui le ressuscita : d'où le secret de ses guérisons.",
      "C'est la seule constellation en deux morceaux, la tête et la queue, de part et d'autre d'Ophiuchus.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "oph",
  },
  Tau: {
    origin: "antique",
    tagline: "Zeus et Europe",
    text: [
      "Le Taureau est Zeus transformé pour séduire la princesse Europe : il se mêle au troupeau de son père, la fascine, puis l'emporte sur son dos à travers la mer jusqu'en Crète.",
      "Dans le ciel, on ne voit que la moitié avant du taureau, qui sort des flots.",
      "Aldébaran est son œil rouge ; les Pléiades et les Hyades, deux amas d'étoiles, brillent sur son épaule et son visage.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin.",
    plate: "tau",
  },
  Tri: {
    origin: "antique",
    tagline: "Le delta du Nil",
    text: [
      "Pour les Grecs, c'est la lettre delta, qui rappelle le delta du Nil et donc l'Égypte ; d'autres y voient la Sicile, île triangulaire que Zeus aurait placée au ciel à la demande de Déméter.",
      "Petit mais net, il est tout près de la galaxie du Triangle (M33), la troisième plus grande galaxie du Groupe local.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "and",
  },
  UMa: {
    origin: "antique",
    tagline: "Callisto changée en ourse",
    text: [
      "La Grande Ourse est Callisto, nymphe de la suite d'Artémis. Aimée de Zeus, elle est changée en ourse par Héra jalouse. Son fils Arcas, devenu chasseur, s'apprête à la tuer sans la reconnaître.",
      "Zeus intervient et les place tous deux au ciel. Héra, furieuse, obtient que l'Ourse ne puisse jamais se baigner dans l'océan : sous nos latitudes, elle ne se couche pas.",
      "Sept de ses étoiles forment le « Grand Chariot » (ou la Casserole), qui sert à trouver l'étoile Polaire.",
    ],
    source: "Récit résumé d'après Ovide (Les Métamorphoses) et Hygin.",
    plate: "uma",
  },
  UMi: {
    origin: "antique",
    tagline: "L'ourse du pôle",
    text: [
      "La Petite Ourse porte au bout de sa queue l'étoile Polaire, qui marque le pôle Nord céleste. Les navigateurs phéniciens, dit-on, s'en servaient pour se guider, d'où son nom grec de « Phénicienne ».",
      "Selon les récits, c'est Arcas, fils de Callisto, ou la nymphe Cynosura, qui avait élevé Zeus en Crète. « Cynosura » signifie « queue de chien » et a donné le mot « cynosure », point de mire.",
    ],
    source: "Récit résumé d'après Aratos (Les Phénomènes) et Hygin.",
    plate: "dra",
  },
  Vir: {
    origin: "antique",
    tagline: "La déesse de la justice et de la moisson",
    text: [
      "La Vierge est le plus souvent Astrée, déesse de la justice, dernière immortelle à quitter la Terre quand l'âge d'or s'achève ; sa balance reste à côté d'elle. Pour d'autres, c'est Déméter, déesse des moissons, qui tient l'épi.",
      "Une troisième version y voit Érigone, fille d'Icarios, qui se pendit de chagrin à la mort de son père et fut placée au ciel avec lui et son chien.",
      "L'Épi (Spica) est son étoile principale.",
    ],
    source: "Récit résumé d'après Hygin et Ératosthène.",
    plate: "vir",
  },
  Com: {
    origin: "antique",
    tagline: "La chevelure de la reine",
    text: [
      "Vers 245 avant notre ère, Bérénice II, reine d'Égypte, fait vœu d'offrir sa chevelure à Aphrodite si son mari, Ptolémée III, revient vainqueur de la guerre. Il revient ; elle coupe ses cheveux et les dépose au temple.",
      "Les cheveux disparaissent. L'astronome Conon de Samos affirme alors qu'Aphrodite les a placés parmi les étoiles. Le poète Callimaque en fait un poème, que Catulle traduit ensuite.",
      "Longtemps simple amas d'étoiles sous la queue du Lion, elle devient une constellation à part entière au XVIe siècle.",
    ],
    source: "Récit résumé d'après Callimaque, Catulle et Hygin.",
    plate: "boo",
  },
  Car: {
    origin: "antique",
    tagline: "La coque du navire des Argonautes",
    text: [
      "La Carène est la coque d'Argo, le navire sur lequel Jason et les Argonautes partirent chercher la Toison d'or. Construit par Argos avec l'aide d'Athéna, c'est selon la légende le premier navire de l'histoire grecque.",
      "Argo était si grand qu'il occupait un quart du ciel : en 1763, Lacaille le divisa en trois constellations plus maniables, la Carène (la coque), la Poupe et les Voiles.",
      "Canopus, son étoile principale, est la deuxième étoile la plus brillante du ciel.",
    ],
    source: "Récit d'après Apollonios de Rhodes (Les Argonautiques) et Hygin ; division par Lacaille en 1763.",
    plate: "hya",
  },
  Pup: {
    origin: "antique",
    tagline: "L'arrière du navire Argo",
    text: [
      "La Poupe est l'arrière d'Argo, le navire de Jason, dont l'histoire est racontée à propos de la Carène. Ses étoiles sont noyées dans la Voie lactée, qui y est riche en amas d'étoiles.",
      "Séparée d'Argo par Lacaille en 1763, elle forme avec la Carène et les Voiles ce qui était l'une des 48 constellations de Ptolémée.",
    ],
    source: "Récit d'après Apollonios de Rhodes (Les Argonautiques) ; division d'Argo par Lacaille en 1763.",
    plate: "hya",
  },
  Vel: {
    origin: "antique",
    tagline: "Les voiles d'Argo",
    text: [
      "Les Voiles sont la voilure d'Argo, le navire de Jason, dont l'histoire est racontée à propos de la Carène. Elles se trouvent dans une région de la Voie lactée riche en nébuleuses, avec les restes d'une supernova vieille de plusieurs milliers d'années.",
      "Séparées d'Argo par Lacaille en 1763, elles forment avec la Carène et la Poupe ce qui était l'une des 48 constellations de Ptolémée.",
    ],
    source: "Récit d'après Apollonios de Rhodes (Les Argonautiques) ; division d'Argo par Lacaille en 1763.",
    plate: "hya",
  },
  Ori: {
    origin: "antique",
    tagline: "Le chasseur géant",
    text: [
      "Orion est un chasseur géant, fils de Poséidon dans la plupart des récits grecs. Il se vante de pouvoir abattre toutes les bêtes de la Terre. Gaïa, offensée, envoie un scorpion qui le tue d'une piqûre.",
      "Zeus les place tous deux dans le ciel, mais aux deux bouts : Orion se couche quand le Scorpion se lève, et on ne les voit presque jamais ensemble.",
      "Dans d'autres versions, c'est Artémis qui le tue par erreur, trompée par son frère Apollon.",
    ],
    source: "Récit résumé d'après Hygin (L'Astronomie poétique) et Ovide (Les Fastes).",
    plate: "ori",
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
    plate: "cas",
  },
};
