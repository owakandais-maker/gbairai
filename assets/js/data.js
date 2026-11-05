/**
 * data.js — seed catalogue + the matching engine.
 *
 * Scores are computed, not hard-coded: the previous build stored a `match`
 * number on each record and also rendered `Math.random()` percentages next to
 * it, so the same candidate showed two different figures on one screen.
 */

export const CONTRACTS = ['CDI', 'CDD', 'Freelance', 'Stage', 'Alternance'];

export const JOBS = [
  {
    id: 'j1', title: 'Senior Frontend Engineer', company: 'TechFlow', logoColor: '#3b82f6',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=70',
    salaryMin: 60, salaryMax: 80, currency: '€', contract: 'CDI', location: 'Paris', remote: true,
    tags: ['React', 'TypeScript', 'Design System', 'Accessibilité'],
    postedAt: Date.now() - 2 * 3600e3, applicants: 34, views: 1280,
    description: "Vous piloterez l'architecture front-end de notre plateforme temps réel : design system partagé, performance sur mobile bas de gamme et accessibilité au niveau WCAG AA.",
    about: 'TechFlow simplifie le Big Data pour les équipes produit. 140 personnes, 11 nationalités, rentable depuis 2023.',
    perks: ['Télétravail 3j/semaine', 'Stock options', 'Budget matériel 2 500 €', 'Mutuelle famille'],
    seniority: 5,
  },
  {
    id: 'j2', title: 'Product Designer', company: 'Creativ', logoColor: '#ec4899',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?auto=format&fit=crop&w=800&q=70',
    salaryMin: 45, salaryMax: 65, currency: '€', contract: 'Freelance', location: 'Remote', remote: true,
    tags: ['Figma', 'UI/UX', 'Prototyping', 'User Research'],
    postedAt: Date.now() - 5 * 3600e3, applicants: 58, views: 2140,
    description: 'Concevoir des expériences utilisateur exceptionnelles, de la recherche terrain aux maquettes haute fidélité, en binôme avec les développeurs.',
    about: 'Studio de design digital indépendant, 18 personnes, clients SaaS et culture.',
    perks: ['100 % remote', 'Semaine de 4 jours', 'Budget formation'],
    seniority: 4,
  },
  {
    id: 'j3', title: 'Marketing Director', company: 'GrowthInc', logoColor: '#22c55e',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=800&q=70',
    salaryMin: 70, salaryMax: 90, currency: '€', contract: 'CDI', location: 'Lyon', remote: false,
    tags: ['Growth', 'Ads', 'SEO', 'Analytics'],
    postedAt: Date.now() - 26 * 3600e3, applicants: 21, views: 760,
    description: "Piloter la stratégie d'acquisition multicanale et construire une équipe de 8 personnes sur 18 mois.",
    about: 'GrowthInc accélère la croissance des scale-ups B2B européennes.',
    perks: ['Voiture de fonction', 'Bonus sur objectifs', 'Intéressement'],
    seniority: 8,
  },
  {
    id: 'j4', title: 'Data Scientist', company: 'DataCorp', logoColor: '#a855f7',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=70',
    salaryMin: 55, salaryMax: 75, currency: '€', contract: 'CDI', location: 'Bordeaux', remote: true,
    tags: ['Python', 'IA', 'MLOps', 'SQL'],
    postedAt: Date.now() - 30 * 3600e3, applicants: 44, views: 1530,
    description: 'Exploiter nos données pour des modèles prédictifs mis en production, du notebook au endpoint monitoré.',
    about: "Pionniers de l'IA éthique appliquée à la logistique.",
    perks: ['Formation continue', 'Conférences payées', 'Remote partiel'],
    seniority: 4,
  },
  {
    id: 'j5', title: 'Ingénieur DevOps / SRE', company: 'CloudNine', logoColor: '#0ea5e9',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=70',
    salaryMin: 58, salaryMax: 78, currency: '€', contract: 'CDI', location: 'Remote', remote: true,
    tags: ['Kubernetes', 'Terraform', 'Observabilité', 'Go'],
    postedAt: Date.now() - 3 * 86400e3, applicants: 17, views: 640,
    description: "Fiabiliser une plateforme multi-régions : SLO, budget d'erreur, astreinte saine et automatisation de bout en bout.",
    about: 'CloudNine héberge des applications critiques pour le secteur santé.',
    perks: ['Astreinte rémunérée', 'Full remote UE', 'Semaine de 4,5 jours'],
    seniority: 6,
  },
  {
    id: 'j6', title: 'Expert Cybersécurité', company: 'Fortress', logoColor: '#ef4444',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=70',
    salaryMin: 65, salaryMax: 95, currency: '€', contract: 'CDI', location: 'Paris', remote: false,
    tags: ['Pentesting', 'Python', 'SOC', 'Cybersecurity'],
    postedAt: Date.now() - 4 * 86400e3, applicants: 12, views: 410,
    description: 'Mener les audits offensifs internes et accompagner les équipes produit sur la remédiation.',
    about: 'Fortress protège les infrastructures sensibles de 40 grands comptes.',
    perks: ['Certifications payées', 'Lab dédié', 'Prime de vulnérabilité'],
    seniority: 7,
  },
  {
    id: 'j7', title: 'Développeur Fullstack', company: 'Orbit', logoColor: '#f59e0b',
    image: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=800&q=70',
    salaryMin: 42, salaryMax: 58, currency: '€', contract: 'CDD', location: 'Abidjan', remote: true,
    tags: ['Node.js', 'Vue', 'PostgreSQL', 'JavaScript'],
    postedAt: Date.now() - 6 * 86400e3, applicants: 73, views: 2460,
    description: 'Construire les nouvelles briques de notre marketplace, du schéma de base aux écrans mobiles.',
    about: "Orbit connecte l'artisanat ouest-africain aux marchés internationaux.",
    perks: ['Remote hybride', 'Prime annuelle', 'Équipement fourni'],
    seniority: 3,
  },
  {
    id: 'j8', title: 'Content & Brand Lead', company: 'Studio Baobab', logoColor: '#14b8a6',
    image: 'https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=800&q=70',
    salaryMin: 38, salaryMax: 52, currency: '€', contract: 'CDI', location: 'Dakar', remote: true,
    tags: ['Content', 'SEO', 'Brand', 'Social'],
    postedAt: Date.now() - 8 * 86400e3, applicants: 29, views: 980,
    description: 'Porter la voix de la marque sur six marchés, du calendrier éditorial à la production vidéo.',
    about: 'Studio créatif panafricain, 24 personnes à Dakar et Abidjan.',
    perks: ['Remote', 'Studio vidéo interne', 'Budget création'],
    seniority: 5,
  },
];

export const CANDIDATES = [
  {
    id: 'c1', name: 'Sarah Connor', role: 'UX Designer', years: 5, location: 'Lyon', remote: true,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=320&q=70',
    cover: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=70',
    tags: ['Figma', 'UI/UX', 'Prototyping', 'User Research'],
    bio: "Designer produit passionnée par les interfaces sobres et les systèmes de design durables. Je travaille au plus près des équipes de développement.",
    education: 'Master Design — Gobelins', availability: 'Immédiate',
    skills: ['Prototyping', 'User Research', 'Design System', 'Figma', 'Accessibilité'],
    languages: ['Français', 'Anglais'], wanted: { salaryMin: 48, contract: 'CDI' },
  },
  {
    id: 'c2', name: 'John Wick', role: 'Security Expert', years: 12, location: 'Paris', remote: false,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=320&q=70',
    cover: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=70',
    tags: ['Cybersecurity', 'Python', 'Pentesting'],
    bio: "Expert en sécurité offensive. J'audite, je documente, et je forme les équipes à corriger durablement.",
    education: 'MSc Cybersecurity', availability: 'Préavis 3 mois',
    skills: ['Pentesting', 'Python', 'SOC', 'Forensics', 'Cybersecurity'],
    languages: ['Français', 'Anglais', 'Russe'], wanted: { salaryMin: 72, contract: 'CDI' },
  },
  {
    id: 'c3', name: 'Emily Blunt', role: 'Marketing Lead', years: 8, location: 'Remote', remote: true,
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=320&q=70',
    cover: 'https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=800&q=70',
    tags: ['SEO', 'Content', 'Growth', 'Analytics'],
    bio: 'Stratège marketing orientée mesure. Je construis des moteurs d’acquisition qui tiennent après mon départ.',
    education: 'MBA Marketing — ESSEC', availability: '1 mois',
    skills: ['Growth', 'SEO', 'Content', 'Analytics', 'Ads'],
    languages: ['Anglais', 'Français'], wanted: { salaryMin: 65, contract: 'CDI' },
  },
  {
    id: 'c4', name: 'Michael Chen', role: 'Fullstack Developer', years: 4, location: 'Bordeaux', remote: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=320&q=70',
    cover: 'https://images.unsplash.com/photo-1587620962725-abab7fe55159?auto=format&fit=crop&w=800&q=70',
    tags: ['Node.js', 'Vue', 'PostgreSQL'],
    bio: 'Développeur fullstack curieux, à l’aise du schéma de base jusqu’à l’animation CSS.',
    education: 'Ingénieur INSA Lyon', availability: 'Immédiate',
    skills: ['JavaScript', 'Node.js', 'Vue', 'PostgreSQL', 'SQL'],
    languages: ['Français', 'Anglais', 'Mandarin'], wanted: { salaryMin: 46, contract: 'CDI' },
  },
  {
    id: 'c5', name: 'Aminata Diallo', role: 'Data Scientist', years: 6, location: 'Dakar', remote: true,
    avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=320&q=70',
    cover: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=800&q=70',
    tags: ['Python', 'IA', 'MLOps'],
    bio: 'Je mets des modèles en production et je les surveille. La partie intéressante commence après le notebook.',
    education: 'PhD Statistiques — UCAD', availability: '2 mois',
    skills: ['Python', 'IA', 'MLOps', 'SQL', 'Analytics'],
    languages: ['Français', 'Anglais', 'Wolof'], wanted: { salaryMin: 58, contract: 'CDI' },
  },
  {
    id: 'c6', name: 'Lucas Moreau', role: 'SRE / DevOps', years: 7, location: 'Remote', remote: true,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=320&q=70',
    cover: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=70',
    tags: ['Kubernetes', 'Terraform', 'Go'],
    bio: 'Je rends les plateformes prévisibles : SLO mesurés, astreinte supportable, déploiements sans drame.',
    education: 'Master Systèmes Distribués', availability: 'Immédiate',
    skills: ['Kubernetes', 'Terraform', 'Go', 'Observabilité', 'Python'],
    languages: ['Français', 'Anglais'], wanted: { salaryMin: 62, contract: 'CDI' },
  },
];

export const SEED_ADS = [
  {
    id: 'a1', type: 'image',
    url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&q=70',
    title: 'Forum Emploi Tech 2026', kicker: 'Événement',
    cta: 'Acheter un billet', link: 'https://example.com/billets',
    buttons: [{ label: 'Voir le programme', link: 'https://example.com/programme' }],
  },
  {
    id: 'a2', type: 'image',
    url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1600&q=70',
    title: 'Masterclass Pitch Vidéo', kicker: 'Formation',
    cta: "S'inscrire", link: 'https://example.com/masterclass', buttons: [],
  },
];

export const SEED_WALLET = {
  balance: 12_480,
  transactions: [
    { id: 't1', label: 'Salaire reçu — TechFlow', amount: 2400, at: Date.now() - 4 * 3600e3, kind: 'salary' },
    { id: 't2', label: 'Billet Forum Emploi Tech', amount: -300, at: Date.now() - 28 * 3600e3, kind: 'ticket' },
    { id: 't3', label: 'Bonus de match', amount: 150, at: Date.now() - 2 * 86400e3, kind: 'bonus' },
    { id: 't4', label: 'Masterclass Pitch Vidéo', amount: -120, at: Date.now() - 5 * 86400e3, kind: 'course' },
    { id: 't5', label: 'Mission freelance — Creativ', amount: 1850, at: Date.now() - 9 * 86400e3, kind: 'salary' },
  ],
  // 30 daily points for the sparkline, deterministic so the chart never jumps.
  trend: Array.from({ length: 30 }, (_, i) =>
    9800 + Math.round(2600 * Math.sin(i / 4.1) + 95 * i + 240 * Math.cos(i / 1.7))
  ),
};

export const SEED_CHAT = [
  { id: 'm1', author: 'Alice', text: 'Super plateforme, le pitch vidéo change tout !', locale: 'fr', at: Date.now() - 42 * 60e3 },
  { id: 'm2', author: 'John', text: "Quelqu'un a un poste SRE en remote ?", locale: 'fr', at: Date.now() - 18 * 60e3 },
];

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

/** Jaccard-style overlap of two tag lists, 0..1. */
function overlap(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const setB = new Set(b.map(norm));
  const hits = a.filter((x) => setB.has(norm(x))).length;
  return hits / Math.max(a.length, Math.min(b.length, a.length + 2));
}

/** Shared skills between a candidate and a job, for the "why" panel. */
export function sharedSkills(candidate, job) {
  const want = new Set(job.tags.map(norm));
  return (candidate.skills || candidate.tags || []).filter((s) => want.has(norm(s)));
}

/**
 * Deterministic 0–100 score. Weighted: skills 55 %, seniority 20 %,
 * location/remote 15 %, salary fit 10 %.
 */
export function scoreMatch(candidate, job) {
  const skills = overlap(candidate.skills || candidate.tags, job.tags);

  const gap = Math.abs((candidate.years ?? 0) - (job.seniority ?? 0));
  const seniority = Math.max(0, 1 - gap / 8);

  const sameCity = norm(candidate.location) === norm(job.location);
  const remoteOk = job.remote && candidate.remote;
  const place = sameCity ? 1 : remoteOk ? 0.85 : job.remote || candidate.remote ? 0.5 : 0.15;

  const want = candidate.wanted?.salaryMin ?? 0;
  const salary = !want ? 0.7
    : job.salaryMax >= want ? 1
    : Math.max(0, 1 - (want - job.salaryMax) / Math.max(want, 1));

  const raw = skills * 0.55 + seniority * 0.20 + place * 0.15 + salary * 0.10;
  // Map into 38–99 so an empty overlap never reads as a hard 0 %.
  return Math.round(38 + raw * 61);
}

/** Best job for a candidate, and that score. */
export function bestJobFor(candidate, jobs = JOBS) {
  let best = null, score = -1;
  for (const job of jobs) {
    const s = scoreMatch(candidate, job);
    if (s > score) { score = s; best = job; }
  }
  return { job: best, score: Math.max(score, 0) };
}

/** Score a job against the signed-in seeker profile. */
export function scoreJobForMe(job, me = ME) { return scoreMatch(me, job); }

/** The signed-in seeker, used for recommendations and job match rings. */
export const ME = {
  id: 'me', name: 'Alex', role: 'Frontend Engineer', years: 5,
  location: 'Paris', remote: true,
  skills: ['React', 'TypeScript', 'Design System', 'Accessibilité', 'JavaScript', 'Figma'],
  languages: ['Français', 'Anglais'], wanted: { salaryMin: 55, contract: 'CDI' },
  avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=70',
};

export { norm };
