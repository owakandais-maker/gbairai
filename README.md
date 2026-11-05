# GBAIRAI TRAVAIL

Plateforme de recrutement par **pitch vidéo** : matching IA, portefeuille Taro,
studio live et assistant vocal multilingue.

Application web installable (PWA), **sans framework ni dépendance d'exécution** :
HTML, CSS et modules ES natifs. Elle fonctionne hors connexion et se charge
sans aucun appel réseau bloquant.

```bash
# Lancer en local (n'importe quel serveur statique)
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

> Les modules ES imposent un serveur HTTP : ouvrir `index.html` via `file://`
> ne fonctionne pas (le service worker est également désactivé dans ce cas).

---

## 1. Corrections apportées

Le fichier d'origine était un unique HTML de ~1 500 lignes. Chaque point
ci-dessous correspond à un défaut réel qui a été reproduit puis corrigé.

### Bogues bloquants

| # | Problème | Correction |
|---|----------|-----------|
| 1 | **Texte corrompu** (`Mode cr�ateur`, `Ajout�`, `g�rer`…) : le fichier mélangeait deux encodages. | Tout le projet est en UTF-8 validé. |
| 2 | **`showAd()` défini deux fois** : la seconde définition écrasait la première et supprimait silencieusement les boutons additionnels des publicités. | Une seule implémentation, pilotée par un carrousel. |
| 3 | **Mode sombre inopérant** : `toggleTheme()` ajoutait la classe `dark-mode`, qu'aucune règle CSS ne définissait. | Thème piloté par tokens (`data-theme`), avec les trois états clair / sombre / système. |
| 4 | **Modales jamais refermées** : les conteneurs cumulaient `hidden` et `flex`, et `flex` l'emportait. | Une seule classe pilote la visibilité de chaque couche. |
| 5 | **Panneau IA mal positionné** : `class="bottom-100px right-24"` n'est pas du Tailwind valide. | Positionnement CSS réel, adapté au mobile. |
| 6 | **Animations absentes** : le markup utilisait `animate-fade-in`, le CSS définissait `fade-in`. | Noms alignés, plus révélation au défilement. |
| 7 | **`prompt()` bloquants** pour créer une alerte. | Formulaire validé, dans une modale. |
| 8 | **Scores incohérents** : `match` figé dans les données *et* `Math.random()` affiché à côté — deux chiffres différents pour le même profil. | Moteur de matching déterministe et pondéré. |
| 9 | **Langue de la reconnaissance vocale figée** à l'initialisation : changer de langue ne la changeait pas. | Le micro suit la langue active ; les erreurs (`not-allowed`, `no-speech`) sont gérées. |
| 10 | **Voix de synthèse ignorée** : `getVoices()` renvoie une liste vide au premier appel sur Chrome. | Résolution différée des voix, avec repli par langue puis par genre. |
| 11 | **Traduction cumulative** : chaque clic ajoutait un préfixe, d'où `[EN] [EN] [FR] bonjour`. | La traduction est un champ distinct, idempotent. |
| 12 | **`localStorage` non protégé** : en navigation privée Safari, l'écriture lève et interrompait le démarrage. | Accès encapsulé, repli mémoire, quota géré. |
| 13 | **Prénoms avec apostrophe** cassaient le HTML (`app.openVideo('${c.name}')`). | Plus aucun handler inline. |

### Sécurité

- **XSS corrigée.** Chats, commentaires, titres de publicités et champs de
  formulaire étaient injectés via `innerHTML` : `<img src=x onerror=…>` dans le
  chat s'exécutait. Tout le rendu passe désormais par `h()` et des nœuds texte.
- **URLs validées.** Les champs média/lien acceptaient `javascript:`. Seuls
  `http(s)` passent (`safeUrl`), et les liens sortants portent
  `rel="noopener noreferrer nofollow"`.
- **Aucune ressource tierce exécutable** : plus de CDN de script.

### Accessibilité

- Navigation complète au clavier, pièges de focus dans les dialogues, focus
  restitué à la fermeture, `Échap` sur la couche supérieure uniquement.
- Lien d'évitement, points de repère, un `<h1>` par page, `aria-*` cohérents.
- Audit automatisé : 0 bouton sans nom accessible, 0 image sans `alt`,
  0 champ sans libellé, 0 cible tactile sous 30 px.
- `prefers-reduced-motion` et `prefers-color-scheme` respectés.

### Correctifs trouvés en test navigateur

- Les toasts recouvraient le champ de saisie du chat et interceptaient les clics.
- Un `z-index` de panneau supérieur à celui des modales rendait les dialogues
  inopérants quand le chat était ouvert.
- Les icônes des champs de recherche flottaient au-dessus des champs après le
  passage aux SVG en ligne (sélecteurs CSS `i` devenus obsolètes).
- Les pastilles du carrousel ne faisaient que 8 px de haut : zone de contact
  portée à 44 px sans changer le visuel.
- Une image du catalogue renvoyait 404 (héritée du fichier d'origine).
- Les huit outils de la barre de navigation débordaient de l'écran sur mobile :
  les secondaires passent dans un menu de dépassement.
- Le service worker renvoyait `Response.error()`, d'où des erreurs réseau en
  console : réponses 504 propres et image de remplacement hors ligne.

---

## 2. Fonctionnalités

**Recherche et matching**
- Moteur de score déterministe : compétences 55 %, séniorité 20 %,
  localisation/remote 15 %, adéquation salariale 10 %.
- Filtres combinables (texte, ville, salaire, contrat, remote, favoris) et
  quatre tris. Explication « pourquoi ce match » sur chaque fiche.
- Recommandations IA, favoris et alertes persistés localement.

**Assistant IA**
- Routage d'intentions sur les 7 langues : navigation, filtrage, ouverture de
  fiches, favoris, alertes, thème, installation.
- Dictée (Web Speech) et synthèse vocale, 6 personas (homme/femme ×
  adulte/enfant/senior), coupure possible.

**Interface**
- Palette de commandes (`Ctrl`/`⌘ + K`), raccourcis `H J R W S`, aide `?`.
- Thème clair / sombre / système, sans flash au chargement.
- 7 langues avec RTL complet pour l'arabe ; nombres, dates et temps relatifs
  formatés via `Intl`.
- Zone publicitaire : carrousel, lecture automatique désactivable, mise en
  pause au survol et en arrière-plan, gestion réservée au mode créateur.
- Portefeuille Taro avec sparkline SVG, studio live avec indicateurs.

**Plateforme**
- PWA installable : manifeste, raccourcis, icônes (dont maskable).
- Service worker : *stale-while-revalidate* pour la coquille, *cache-first*
  pour polices et images (plafonné à 60 entrées), repli hors ligne.
- 56 icônes SVG en ligne — plus de police d'icônes distante.

---

## 3. Structure

```
index.html                 coquille + anti-flash de thème
manifest.webmanifest       métadonnées PWA
sw.js                      service worker (précache + stratégies)
assets/css/app.css         design system (tokens, clair/sombre, RTL)
assets/js/
  app.js                   amorçage, routeur, thème, raccourcis
  views.js                 pages et cartes
  features.js              panneaux, carrousel, formulaires validés
  ui.js                    toasts, modales, tiroirs, palette
  ai.js                    voix et intentions
  data.js                  catalogue et moteur de matching
  i18n.js                  7 langues
  dom.js                   constructeur DOM sûr, focus, utilitaires
  icons.js                 56 icônes SVG
  store.js                 état observable, persistance protégée
assets/icons/              icônes PWA
```

## 4. Vérification

Testé sous Chromium (Playwright) à 1440×960 et 390×844 :
toutes les routes, dialogues, formulaires, les 7 langues, le RTL, les deux
thèmes, le clavier seul, le rechargement hors ligne et la persistance.
**Aucune erreur console, aucune exception, aucun défilement horizontal.**

## 5. Notes

- Les données (offres, profils, portefeuille) sont un jeu de démonstration en
  mémoire ; brancher une API revient à remplacer `data.js`.
- La traduction du chat est une **simulation** : elle étiquette la langue cible
  sans traduire, en attendant un service réel. C'est explicite dans le code.
- Les images de démonstration proviennent d'Unsplash et nécessitent le réseau
  au premier affichage ; elles sont ensuite servies depuis le cache. Si une
  image est indisponible (réseau coupé, politique de sécurité restrictive), une
  tuile dégradée déterministe prend sa place : la mise en page reste intacte.
- Le routage utilise des ancres simples (`#jobs`, `#wallet`…), compatibles avec
  les environnements embarqués qui ne propagent pas les chemins.
- Mode créateur : bouton couronne dans la barre, ou `?creator=1` dans l'URL.
