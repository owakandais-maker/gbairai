/* ==========================================================================
   seed.js — contenu de démonstration de GBAIRAI ZONE
   Aucune URL externe : les visuels manquants sont remplacés par des vignettes
   générées localement, donc aucune requête réseau ne peut échouer.
   ========================================================================== */

const H = 3600e3;
const D = 24 * H;
const now = () => Date.now();

function mkUsers() {
  return [
    {
      id: 'me', handle: 'owak', name: 'Omar Wakandais', owner: true, verified: true,
      bio: 'Concepteur de GBAIRAI ZONE. Je bâtis la zone où tout se passe.',
      city: 'Abidjan', link: 'gbairai.zone', avatar: null, banner: null,
      avatarShape: 'square', followers: 48213, following: 312, likes: 1_204_553,
      saved: [], joined: now() - 420 * D, taro: 185000, role: 'Concepteur',
    },
    {
      id: 'u_kaito', handle: 'kaito', name: 'Kaito Reyes', verified: true,
      bio: 'Créateur de vidéos. Un nouveau short chaque soir à 20 h GMT.',
      city: 'Abidjan', link: null, followers: 182400, following: 540, likes: 3_980_112,
      saved: [], joined: now() - 300 * D, taro: 42000, role: 'Créateur',
    },
    {
      id: 'u_awa', handle: 'awa.cuisine', name: 'Awa Koné', verified: true,
      bio: 'Cuisine ivoirienne moderne. Garba revisité, sauce graine et compagnie.',
      city: 'Yopougon', followers: 96100, following: 210, likes: 1_540_900,
      saved: [], joined: now() - 260 * D, taro: 31500, role: 'Cheffe',
    },
    {
      id: 'u_zaprod', handle: 'zaprod', name: 'ZA PROD', verified: true,
      bio: 'Régie live officielle de la zone. Plateaux, concerts, débats.',
      city: 'Cocody', followers: 254000, following: 88, likes: 5_210_440,
      saved: [], joined: now() - 500 * D, taro: 760000, role: 'Studio',
    },
    {
      id: 'u_sika', handle: 'sika.market', name: 'Sika Market', verified: false,
      bio: 'Boutique de la zone : pagne, sneakers, électronique. Séquestre TARO.',
      city: 'Treichville', followers: 41200, following: 130, likes: 302_118,
      saved: [], joined: now() - 180 * D, taro: 128000, role: 'Boutique',
    },
    {
      id: 'u_djobe', handle: 'djobe.ci', name: 'Djobe CI', verified: true,
      bio: 'Offres d\'emploi vérifiées en Côte d\'Ivoire et dans la sous-région.',
      city: 'Plateau', followers: 73800, following: 64, likes: 188_420,
      saved: [], joined: now() - 220 * D, taro: 54000, role: 'Emploi',
    },
    {
      id: 'u_nina', handle: 'nina.beat', name: 'Nina Beat', verified: false,
      bio: 'Productrice. Coupé-décalé, afro-drill, instrus libres de droits.',
      city: 'Marcory', followers: 28900, following: 402, likes: 410_330,
      saved: [], joined: now() - 150 * D, taro: 19500, role: 'Artiste',
    },
    {
      id: 'u_moussa', handle: 'moussa.tech', name: 'Moussa Traoré', verified: false,
      bio: 'Développeur web. Je parle JavaScript et nouchi.',
      city: 'Bingerville', followers: 12400, following: 630, likes: 92_180,
      saved: [], joined: now() - 120 * D, taro: 8600, role: 'Développeur',
    },
    {
      id: 'u_fatou', handle: 'fatou.style', name: 'Fatou Diallo', verified: false,
      bio: 'Styliste. Le pagne n\'a pas dit son dernier mot.',
      city: 'Adjamé', followers: 64300, following: 288, likes: 720_410,
      saved: [], joined: now() - 200 * D, taro: 23800, role: 'Styliste',
    },
  ];
}

function mkPosts() {
  const t0 = now();
  return [
    {
      id: 'p1', userId: 'u_zaprod', at: t0 - 25 * 60e3,
      text: 'Ce soir 21 h GMT : plateau spécial « La zone parle » avec trois invités surprise. '
        + 'La régie est prête, le bandeau est calé, le compte à rebours tourne. #zaprod #live #gbairaizone',
      tags: ['zaprod', 'live', 'gbairaizone'],
      media: [{ id: 'pm1', kind: 'image', ref: null, label: 'Plateau ZA PROD', w: 1600, h: 900 }],
      likes: 1842, shares: 211, views: 58400, allowDownload: true, pinned: true,
    },
    {
      id: 'p2', userId: 'u_awa', at: t0 - 2 * H,
      text: 'Sauce graine façon grand-mère, version express en 35 minutes. '
        + 'Le secret c\'est le feu doux et la patience. Recette complète en commentaire. #cuisine #garba #abidjan',
      tags: ['cuisine', 'garba', 'abidjan'],
      media: [
        { id: 'pm2', kind: 'image', ref: null, label: 'Sauce graine', w: 1200, h: 900 },
        { id: 'pm3', kind: 'image', ref: null, label: 'Attiéké', w: 1200, h: 900 },
      ],
      likes: 3210, shares: 540, views: 121_800, allowDownload: true,
    },
    {
      id: 'p3', userId: 'u_kaito', at: t0 - 5 * H,
      text: 'J\'ai testé la recherche vocale de GBAIRAI ZONE pendant deux jours. '
        + 'Verdict : je ne tape plus rien, je parle. #gbzn #astuce',
      tags: ['gbzn', 'astuce'],
      media: [], likes: 920, shares: 88, views: 34_200, allowDownload: true,
    },
    {
      id: 'p4', userId: 'u_fatou', at: t0 - 9 * H,
      text: 'Collection « Zone Royale » : six pièces, un seul pagne, zéro chute de tissu. '
        + 'Les commandes passent par la boutique avec séquestre TARO. #mode #pagne #taro',
      tags: ['mode', 'pagne', 'taro'],
      media: [
        { id: 'pm4', kind: 'image', ref: null, label: 'Zone Royale 1', w: 1200, h: 1500 },
        { id: 'pm5', kind: 'image', ref: null, label: 'Zone Royale 2', w: 1200, h: 1500 },
        { id: 'pm6', kind: 'image', ref: null, label: 'Zone Royale 3', w: 1200, h: 1500 },
      ],
      likes: 5120, shares: 980, views: 204_000, allowDownload: false,
    },
    {
      id: 'p5', userId: 'u_moussa', at: t0 - 14 * H,
      text: 'Petite leçon : un bouton qui ne fait rien n\'est pas un bouton, c\'est une décoration. '
        + 'Dans la zone, chaque option est branchée. #dev #javascript',
      tags: ['dev', 'javascript'],
      media: [], likes: 640, shares: 42, views: 18_900, allowDownload: true,
    },
    {
      id: 'p6', userId: 'u_nina', at: t0 - 20 * H,
      text: 'Nouvelle instru libre : « Zone Nocturne ». Prends-la, poste ton short, tague-moi. #son #instru',
      tags: ['son', 'instru'],
      media: [{ id: 'pm7', kind: 'image', ref: null, label: 'Zone Nocturne', w: 1400, h: 1400 }],
      likes: 1480, shares: 310, views: 62_400, allowDownload: true,
    },
    {
      id: 'p7', userId: 'u_sika', at: t0 - 28 * H,
      text: 'Arrivage : 40 paires de sneakers, 12 ventilateurs, 8 téléphones reconditionnés. '
        + 'Négociation ouverte jusqu\'à -30 %. #boutique #bonsplans',
      tags: ['boutique', 'bonsplans'],
      media: [{ id: 'pm8', kind: 'image', ref: null, label: 'Arrivage Sika', w: 1600, h: 1000 }],
      likes: 780, shares: 150, views: 41_200, allowDownload: true,
    },
    {
      id: 'p8', userId: 'me', at: t0 - 36 * H,
      text: 'La zone s\'ouvre. Un seul agent, OWAK, qui exécute tes demandes dans toute l\'application. '
        + 'Dis-lui ce que tu veux, il le fait. #gbairaizone #owak',
      tags: ['gbairaizone', 'owak'],
      media: [{ id: 'pm9', kind: 'image', ref: null, label: 'GBAIRAI ZONE', w: 1600, h: 900 }],
      likes: 9240, shares: 2100, views: 480_000, allowDownload: true, pinned: true,
    },
    {
      id: 'p9', userId: 'u_djobe', at: t0 - 44 * H,
      text: '14 nouvelles offres vérifiées cette semaine : développement, logistique, vente, santé. '
        + 'La compatibilité se calcule sur ton profil. #emploi #djobe',
      tags: ['emploi', 'djobe'],
      media: [], likes: 410, shares: 190, views: 28_700, allowDownload: true,
    },
    {
      id: 'p10', userId: 'u_kaito', at: t0 - 52 * H,
      text: 'Derrière chaque short de 20 secondes : deux heures de tournage et un montage à 3 h du matin. '
        + 'Respect aux créateurs. #coulisses',
      tags: ['coulisses'],
      media: [{ id: 'pm10', kind: 'image', ref: null, label: 'Coulisses', w: 1400, h: 900 }],
      likes: 2340, shares: 420, views: 98_300, allowDownload: true,
    },
  ];
}

function mkComments() {
  const t0 = now();
  return [
    { id: 'c1', postId: 'p1', userId: 'u_kaito', at: t0 - 20 * 60e3, text: 'Je serai devant mon écran. La régie est propre !', likes: 84, viral: true, relatedTo: 'p1' },
    { id: 'c2', postId: 'p1', userId: 'u_nina', at: t0 - 15 * 60e3, text: 'Je prête une instru pour le générique si vous voulez.', likes: 31 },
    { id: 'c3', postId: 'p2', userId: 'me', at: t0 - 100 * 60e3, text: 'La recette complète mérite un short dédié.', likes: 210, viral: true, relatedTo: 'v2' },
    { id: 'c4', postId: 'p2', userId: 'u_fatou', at: t0 - 90 * 60e3, text: 'J\'ai testé hier, c\'est validé par toute la famille.', likes: 64 },
    { id: 'c5', postId: 'p4', userId: 'u_awa', at: t0 - 8 * H, text: 'La pièce numéro trois, je la veux en taille M.', likes: 120 },
    { id: 'c6', postId: 'p8', userId: 'u_moussa', at: t0 - 30 * H, text: 'OWAK m\'a rangé mes enregistrements en une phrase. Dingue.', likes: 540, viral: true, relatedTo: 'v1' },
    { id: 'c7', postId: 'p8', userId: 'u_zaprod', at: t0 - 28 * H, text: 'La zone était attendue. Bravo.', likes: 320 },
    { id: 'c8', postId: 'p6', userId: 'u_kaito', at: t0 - 18 * H, text: 'Instru prise, short en préparation.', likes: 88 },
  ];
}

function mkShorts() {
  const t0 = now();
  return [
    {
      id: 'v1', userId: 'u_kaito', at: t0 - 40 * 60e3,
      caption: 'POV : tu découvres GBAIRAI ZONE et tu ne ressors plus. #pov #gbzn',
      tags: ['pov', 'gbzn'], ref: null, demo: 'short1',
      soundId: 's1', soundTitle: 'Zone Nocturne', soundArtist: 'Nina Beat', soundUserId: 'u_nina',
      likes: 48_200, comments: 1240, shares: 3100, views: 980_400, allowDownload: true,
      viral: [
        { text: 'Le passage à 0:12 m\'a tué, qui a la version longue ?', to: 'v3' },
        { text: 'Cette instru tourne partout cette semaine', to: 'sound:s1' },
      ],
    },
    {
      id: 'v2', userId: 'u_awa', at: t0 - 3 * H,
      caption: 'Attiéké poisson braisé en 60 secondes. Le feu fait tout. #cuisine #abidjan',
      tags: ['cuisine', 'abidjan'], ref: null, demo: 'short2',
      soundId: 's2', soundTitle: 'Braise et Épices', soundArtist: 'Awa Koné', soundUserId: 'u_awa',
      likes: 92_100, comments: 2410, shares: 7400, views: 2_140_000, allowDownload: true,
      viral: [
        { text: 'La sauce claire mérite sa propre vidéo', to: 'v4' },
        { text: 'Recette écrite dispo sur son profil', to: 'user:u_awa' },
      ],
    },
    {
      id: 'v3', userId: 'u_zaprod', at: t0 - 7 * H,
      caption: 'Coulisses de la régie : un CUT, trois caméras, zéro panique. #zaprod #studio',
      tags: ['zaprod', 'studio'], ref: null, demo: 'short3',
      soundId: 's3', soundTitle: 'Régie Live', soundArtist: 'ZA PROD', soundUserId: 'u_zaprod',
      likes: 31_400, comments: 860, shares: 2200, views: 640_200, allowDownload: false,
      viral: [
        { text: 'Quelqu\'un peut expliquer le pilote auto ?', to: 'v1' },
        { text: 'Le bandeau est trop propre', to: 'user:u_zaprod' },
      ],
    },
    {
      id: 'v4', userId: 'u_fatou', at: t0 - 12 * H,
      caption: 'Un pagne, six tenues, un défilé dans la cour. #mode #pagne',
      tags: ['mode', 'pagne'], ref: null, demo: 'short4',
      soundId: 's1', soundTitle: 'Zone Nocturne', soundArtist: 'Nina Beat', soundUserId: 'u_nina',
      likes: 64_900, comments: 1810, shares: 5200, views: 1_320_000, allowDownload: true,
      viral: [
        { text: 'La tenue bleue, je la veux pour mon mariage', to: 'v2' },
        { text: 'Même son que le short de Kaito', to: 'sound:s1' },
      ],
    },
    {
      id: 'v5', userId: 'u_moussa', at: t0 - 22 * H,
      caption: 'Trois raccourcis clavier qui changent ta vie dans la zone. #dev #astuce',
      tags: ['dev', 'astuce'], ref: null, demo: 'short1',
      soundId: 's4', soundTitle: 'Clavier Mécanique', soundArtist: 'Moussa Traoré', soundUserId: 'u_moussa',
      likes: 18_300, comments: 420, shares: 980, views: 310_500, allowDownload: true,
      viral: [
        { text: 'Le troisième raccourci est illégal tellement c\'est bon', to: 'v1' },
        { text: 'Il explique tout sur son profil', to: 'user:u_moussa' },
      ],
    },
    {
      id: 'v6', userId: 'me', at: t0 - 30 * H,
      caption: 'OWAK publie, range, répond et appelle. Un seul agent pour toute la zone. #owak',
      tags: ['owak'], ref: null, demo: 'short2',
      soundId: 's5', soundTitle: 'Zone Thème', soundArtist: 'Omar Wakandais', soundUserId: 'me',
      likes: 120_400, comments: 4100, shares: 15_800, views: 3_480_000, allowDownload: true,
      viral: [
        { text: 'Je lui ai demandé de vider mon panier, c\'était fait avant la fin de ma phrase', to: 'v5' },
        { text: 'Le thème de la zone en boucle dans ma tête', to: 'sound:s5' },
      ],
    },
  ];
}

function mkStories() {
  const t0 = now();
  return [
    {
      id: 'st1', userId: 'u_kaito', at: t0 - 50 * 60e3, ttl: 24 * H,
      kind: 'image', ref: null, label: 'Tournage du soir', text: 'Tournage du soir, ça chauffe',
      viewers: [{ userId: 'u_awa', at: t0 - 40 * 60e3 }, { userId: 'me', at: t0 - 30 * 60e3 }, { userId: 'u_nina', at: t0 - 12 * 60e3 }],
      allowDownload: true,
    },
    {
      id: 'st2', userId: 'u_awa', at: t0 - 2 * H, ttl: 12 * H,
      kind: 'text', text: 'Attiéké chaud dans 10 minutes. Qui passe ?', bg: 'linear-gradient(135deg,#ff7a3d,#ff3b5c)',
      viewers: [{ userId: 'me', at: t0 - 90 * 60e3 }, { userId: 'u_fatou', at: t0 - 60 * 60e3 }],
      allowDownload: true,
    },
    {
      id: 'st3', userId: 'u_zaprod', at: t0 - 4 * H, ttl: 24 * H,
      kind: 'video', ref: null, demo: 'short3', clipLen: 8, label: 'Réglage plateau', text: 'Réglage plateau en cours',
      viewers: [{ userId: 'u_kaito', at: t0 - 3 * H }, { userId: 'u_moussa', at: t0 - 2 * H }, { userId: 'me', at: t0 - 1 * H }, { userId: 'u_sika', at: t0 - 40 * 60e3 }],
      allowDownload: false,
    },
    {
      id: 'st4', userId: 'u_fatou', at: t0 - 6 * H, ttl: 24 * H,
      kind: 'image', ref: null, label: 'Essayage', text: 'Essayage avant le défilé',
      viewers: [{ userId: 'u_awa', at: t0 - 5 * H }], allowDownload: true,
    },
  ];
}

function mkThreads() {
  const t0 = now();
  return [
    { id: 'th1', members: ['me', 'u_kaito'], at: t0 - 12 * 60e3, unread: 2, pinned: true },
    { id: 'th2', members: ['me', 'u_awa'], at: t0 - 3 * H, unread: 0 },
    { id: 'th3', members: ['me', 'u_zaprod'], at: t0 - 8 * H, unread: 1 },
    { id: 'th4', members: ['me', 'u_sika'], at: t0 - 26 * H, unread: 0 },
    { id: 'th5', members: ['me', 'u_nina'], at: t0 - 40 * H, unread: 0 },
  ];
}

function mkMessages() {
  const t0 = now();
  return [
    { id: 'm1', threadId: 'th1', userId: 'u_kaito', at: t0 - 50 * 60e3, text: 'Salut ! Tu as vu le nouveau lecteur de shorts ?' },
    { id: 'm2', threadId: 'th1', userId: 'me', at: t0 - 45 * 60e3, text: 'Oui, les réglages s\'ouvrent tout seuls maintenant, sans rien devant.' },
    { id: 'm3', threadId: 'th1', userId: 'u_kaito', at: t0 - 20 * 60e3, text: 'Parfait. On fait un appel vidéo ce soir pour tester le partage de contenu ?' },
    { id: 'm4', threadId: 'th1', userId: 'u_kaito', at: t0 - 12 * 60e3, text: 'Je t\'envoie la liste des shorts à regarder pendant l\'appel.' },
    { id: 'm5', threadId: 'th2', userId: 'u_awa', at: t0 - 4 * H, text: 'Je publie la recette complète ce soir, tu valides le texte ?' },
    { id: 'm6', threadId: 'th2', userId: 'me', at: t0 - 3 * H, text: 'Envoie, je relis dans la demi-heure.' },
    { id: 'm7', threadId: 'th3', userId: 'u_zaprod', at: t0 - 8 * H, text: 'Le studio est calé pour 21 h GMT. Le compte à rebours est branché.' },
    { id: 'm8', threadId: 'th4', userId: 'u_sika', at: t0 - 26 * H, text: 'Ta commande part demain. Le séquestre TARO est libéré à la livraison.' },
    { id: 'm9', threadId: 'th5', userId: 'u_nina', at: t0 - 40 * H, text: 'L\'instru « Zone Nocturne » est à toi, pas de droits à payer.' },
  ];
}

function mkProducts() {
  return [
    { id: 'pr1', userId: 'u_sika', title: 'Sneakers Zone Runner', price: 42_000, oldPrice: 55_000, currency: 'XOF', category: 'Mode', stock: 12, desc: 'Baskets légères, semelle renforcée, livraison Abidjan en 24 h.', tags: ['sneakers', 'mode'], negotiable: true, escrow: true, ref: null, rating: 4.6, sold: 184 },
    { id: 'pr2', userId: 'u_fatou', title: 'Ensemble pagne Zone Royale', price: 68_000, currency: 'XOF', category: 'Mode', stock: 6, desc: 'Pièce unique, taille sur mesure, finitions main.', tags: ['pagne', 'mode'], negotiable: true, escrow: true, ref: null, rating: 4.9, sold: 42 },
    { id: 'pr3', userId: 'u_sika', title: 'Téléphone reconditionné 128 Go', price: 115_000, oldPrice: 140_000, currency: 'XOF', category: 'Électronique', stock: 8, desc: 'Batterie neuve, garantie 6 mois, facture fournie.', tags: ['telephone', 'tech'], negotiable: true, escrow: true, ref: null, rating: 4.3, sold: 96 },
    { id: 'pr4', userId: 'u_awa', title: 'Coffret épices sauce graine', price: 9_500, currency: 'XOF', category: 'Cuisine', stock: 40, desc: 'Sept épices dosées, recette imprimée incluse.', tags: ['cuisine', 'epices'], negotiable: false, escrow: true, ref: null, rating: 4.8, sold: 320 },
    { id: 'pr5', userId: 'u_nina', title: 'Pack 10 instrus libres', price: 25_000, currency: 'XOF', category: 'Musique', stock: 999, desc: 'Dix instrus en WAV, licence commerciale incluse.', tags: ['son', 'instru'], negotiable: true, escrow: false, ref: null, rating: 5, sold: 61 },
    { id: 'pr6', userId: 'u_zaprod', title: 'Billet plateau « La zone parle »', price: 15_000, currency: 'XOF', category: 'Évènement', stock: 120, desc: 'Accès plateau, boisson incluse, 21 h GMT.', tags: ['billet', 'live'], negotiable: false, escrow: true, ref: null, rating: 4.7, sold: 230, isTicket: true },
    { id: 'pr7', userId: 'u_moussa', title: 'Audit de site web', price: 85_000, currency: 'XOF', category: 'Service', stock: 5, desc: 'Rapport complet performance, accessibilité, référencement.', tags: ['dev', 'service'], negotiable: true, escrow: true, ref: null, rating: 4.9, sold: 18 },
    { id: 'pr8', userId: 'u_sika', title: 'Ventilateur rechargeable', price: 28_000, currency: 'XOF', category: 'Maison', stock: 15, desc: 'Autonomie 9 h, trois vitesses, port USB.', tags: ['maison'], negotiable: true, escrow: true, ref: null, rating: 4.1, sold: 73 },
  ];
}

function mkOrders() {
  const t0 = now();
  return [
    { id: 'or_1001', userId: 'me', items: [{ productId: 'pr1', qty: 1, price: 42_000 }], total: 42_000, status: 'Livré', at: t0 - 9 * D, escrow: 'libéré' },
    { id: 'or_1002', userId: 'me', items: [{ productId: 'pr4', qty: 2, price: 9_500 }], total: 19_000, status: 'En transit', at: t0 - 2 * D, escrow: 'bloqué' },
  ];
}

function mkJobs() {
  const t0 = now();
  return [
    { id: 'j1', userId: 'u_djobe', title: 'Développeur front-end', company: 'Orange CI', city: 'Abidjan', type: 'CDI', salary: '900 000 – 1 400 000 F CFA', skills: ['JavaScript', 'CSS', 'Accessibilité'], desc: 'Interfaces grand public, forte exigence de performance mobile.', at: t0 - 2 * D, match: 92 },
    { id: 'j2', userId: 'u_djobe', title: 'Monteur vidéo', company: 'ZA PROD', city: 'Cocody', type: 'CDD', salary: '450 000 – 700 000 F CFA', skills: ['Montage', 'Étalonnage', 'Sound design'], desc: 'Montage de shorts quotidiens et de plateaux live.', at: t0 - 3 * D, match: 78 },
    { id: 'j3', userId: 'u_djobe', title: 'Responsable logistique', company: 'Sika Market', city: 'Treichville', type: 'CDI', salary: '600 000 – 850 000 F CFA', skills: ['Stock', 'Livraison', 'Négociation'], desc: 'Pilotage des arrivages et des livraisons 24 h.', at: t0 - 5 * D, match: 64 },
    { id: 'j4', userId: 'u_djobe', title: 'Community manager', company: 'GBAIRAI ZONE', city: 'Télétravail', type: 'Freelance', salary: '350 000 – 500 000 F CFA', skills: ['Rédaction', 'Nouchi', 'Analyse'], desc: 'Animation des tendances et des campagnes du panneau.', at: t0 - 6 * D, match: 85 },
    { id: 'j5', userId: 'u_djobe', title: 'Infirmier diplômé', company: 'Clinique Sainte-Anne', city: 'Marcory', type: 'CDI', salary: '400 000 – 620 000 F CFA', skills: ['Soins', 'Urgences'], desc: 'Service de nuit, équipe de huit personnes.', at: t0 - 8 * D, match: 41 },
  ];
}

function mkGroups() {
  return [
    { id: 'g1', name: 'Créateurs de la zone', topic: 'Vidéo', desc: 'Entraide montage, cadrage et diffusion.', members: 12_400, joined: true, private: false },
    { id: 'g2', name: 'Cuisine ivoirienne', topic: 'Cuisine', desc: 'Recettes, astuces et marchés.', members: 38_200, joined: true, private: false },
    { id: 'g3', name: 'Dev Abidjan', topic: 'Technologie', desc: 'JavaScript, mobile, accessibilité.', members: 6_800, joined: false, private: false },
    { id: 'g4', name: 'Bons plans Treichville', topic: 'Boutique', desc: 'Arrivages et négociations.', members: 21_900, joined: false, private: false },
    { id: 'g5', name: 'Régie et plateaux', topic: 'Live', desc: 'Techniciens, régisseurs, cadreurs.', members: 3_200, joined: false, private: true },
  ];
}

function mkEvents() {
  const t0 = now();
  return [
    { id: 'e1', title: 'La zone parle — plateau live', place: 'Studio ZA PROD, Cocody', at: t0 + 6 * H, going: true, interested: false, attendees: 240, desc: 'Trois invités, une heure de débat, diffusion en direct.' },
    { id: 'e2', title: 'Défilé Zone Royale', place: 'Palais de la culture, Treichville', at: t0 + 4 * D, going: false, interested: true, attendees: 820, desc: 'Six créatrices, un seul pagne par tenue.' },
    { id: 'e3', title: 'Atelier montage de shorts', place: 'En ligne', at: t0 + 9 * D, going: false, interested: false, attendees: 410, desc: 'De la prise de vue à la publication en deux heures.' },
    { id: 'e4', title: 'Marché des bons plans', place: 'Adjamé', at: t0 + 14 * D, going: false, interested: false, attendees: 1_500, desc: 'Négociation ouverte, paiement TARO accepté.' },
  ];
}

function mkNotifications() {
  const t0 = now();
  return [
    { id: 'n1', kind: 'like', userId: 'u_kaito', at: t0 - 8 * 60e3, text: 'Kaito Reyes a aimé ta publication', hash: '#/post/p8', read: false },
    { id: 'n2', kind: 'comment', userId: 'u_moussa', at: t0 - 40 * 60e3, text: 'Moussa Traoré a commenté ta publication', hash: '#/post/p8', read: false },
    { id: 'n3', kind: 'follow', userId: 'u_fatou', at: t0 - 3 * H, text: 'Fatou Diallo te suit maintenant', hash: '#/u/fatou.style', read: false },
    { id: 'n4', kind: 'live', userId: 'u_zaprod', at: t0 - 5 * H, text: 'ZA PROD est en direct', hash: '#/live', read: true },
    { id: 'n5', kind: 'order', userId: 'u_sika', at: t0 - 2 * D, text: 'Commande or_1002 en transit', hash: '#/shop?tab=orders', read: true },
    { id: 'n6', kind: 'gift', userId: 'u_awa', at: t0 - 3 * D, text: 'Awa Koné t\'a offert 500 TARO', hash: '#/wallet', read: true },
  ];
}

function mkTransactions() {
  const t0 = now();
  return [
    { id: 'tx1', at: t0 - 2 * H, label: 'Cadeau reçu de Awa Koné', kind: 'cadeau', amount: 500, dir: 'in' },
    { id: 'tx2', at: t0 - 2 * D, label: 'Commande or_1002 — séquestre', kind: 'séquestre', amount: -19_000, dir: 'out', held: true },
    { id: 'tx3', at: t0 - 5 * D, label: 'Recharge Mobile Money', kind: 'recharge', amount: 50_000, dir: 'in' },
    { id: 'tx4', at: t0 - 9 * D, label: 'Commande or_1001 — payée', kind: 'achat', amount: -42_000, dir: 'out' },
    { id: 'tx5', at: t0 - 12 * D, label: 'Revenus créateur — shorts', kind: 'revenu', amount: 86_500, dir: 'in' },
  ];
}

function mkStreams() {
  const t0 = now();
  return [
    { id: 'ls1', userId: 'u_zaprod', title: 'La zone parle — plateau du soir', category: 'Débat', viewers: 4_280, live: true, at: t0 - 40 * 60e3 },
    { id: 'ls2', userId: 'u_nina', title: 'Session studio : on fabrique une instru', category: 'Musique', viewers: 860, live: true, at: t0 - 20 * 60e3 },
    { id: 'ls3', userId: 'u_awa', title: 'Cuisine en direct : sauce claire', category: 'Cuisine', viewers: 0, live: false, at: t0 - 2 * D },
  ];
}

function mkAds() {
  return [
    {
      id: 'ad1', title: 'La zone parle — ce soir 21 h GMT', sub: 'Plateau live ZA PROD, trois invités surprise et une régie en direct.',
      kind: 'image', ref: null, label: 'La zone parle', cta: 'Voir le direct', ctaUrl: '#/live', active: true, slot: 7,
      impressions: 184_200, clicks: 9_410,
    },
    {
      id: 'ad2', title: 'Collection Zone Royale', sub: 'Six pièces, un pagne, paiement sous séquestre TARO.',
      kind: 'image', ref: null, label: 'Zone Royale', cta: 'Ouvrir la boutique', ctaUrl: '#/shop', active: true, slot: 7,
      impressions: 142_800, clicks: 7_120,
    },
    {
      id: 'ad3', title: 'Billets plateau disponibles', sub: '120 places, accès plateau, boisson incluse.',
      kind: 'image', ref: null, label: 'Billets plateau', cta: 'Prendre un billet', ctaUrl: '#/shop?id=pr6', active: true, slot: 7,
      impressions: 96_400, clicks: 5_880,
    },
  ];
}

export function seed() {
  return {
    users: mkUsers(),
    posts: mkPosts(),
    comments: mkComments(),
    shorts: mkShorts(),
    stories: mkStories(),
    threads: mkThreads(),
    messages: mkMessages(),
    products: mkProducts(),
    orders: mkOrders(),
    cart: [],
    jobs: mkJobs(),
    applications: [],
    groups: mkGroups(),
    events: mkEvents(),
    notifications: mkNotifications(),
    transactions: mkTransactions(),
    streams: mkStreams(),
    ads: mkAds(),
    likes: { posts: [], shorts: [], comments: [] },
    follows: ['u_kaito', 'u_awa', 'u_zaprod', 'u_djobe'],
    agentLog: [],
    owner: { code: 'CALEB3011', codeChangedAt: null },
    demoMedia: {},
    __removed: {},
  };
}
