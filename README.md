# GBAIRAI ZONE (GBZN)

Le réseau social complet de la zone : fil, shorts, stories, studio live, boutique TARO,
emploi, messagerie et appels — avec **OWAK**, l'agent IA unique qui pilote toute
l'application.

Aucune installation, aucun serveur, aucune clé : ouvrez `index.html`.
Tout reste sur l'appareil (réglages et contenu en `localStorage`, photos et vidéos en
IndexedDB).

## Démarrage

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://127.0.0.1:8000/`. Un double-clic sur `index.html` fonctionne aussi,
mais le mode hors ligne (service worker) demande un vrai serveur.

## Ce que fait l'application

| Section | Contenu |
|---|---|
| **Accueil** | Panneau de la zone, stories, composeur, fil Pour toi / Abonnements / Tendances, rail des tendances |
| **Shorts** | Lecteur vertical, réglages isolés, son, vitesse, saut, qualité, téléchargement, piste musicale, commentaires viraux |
| **Boutique** | Catalogue, panier, négociation de prix, paiement sous séquestre TARO, commandes, mise en vente |
| **En direct** | Liste des directs et **régie ZA PROD** : CUT, transitions, bandeau, compte à rebours, pilote auto, étalonnage, audio |
| **Messages** | LA ZONE DISCUSSION, pièces jointes, appels audio et vidéo, partage de contenu **pendant** l'appel |
| **Profil** | Bannière photo ou vidéo visionnable, avatar carré ou rond, grilles publications / shorts / médias |
| **Portefeuille** | Solde TARO, recharge, transfert, séquestre, mouvements |
| **Emploi** | Offres avec compatibilité, lettre de motivation, coach d'entretien |
| **Groupes · Évènements · Enregistrements · Notifications · Explorer** | Vues complètes, chacune avec sa recherche |
| **Paramètres** | Apparence, langue, confidentialité, notifications, lecture, accessibilité, agent, sécurité, données |
| **Console concepteur** | Campagnes du panneau, billets, statistiques — réservée au concepteur |

## Points de conception

**Flèche de retour.** Présente sur toutes les vues sauf l'accueil, collée au bord, et
elle ramène exactement à la vue précédente avec sa position de défilement
(`assets/js/core/router.js` tient une pile de navigation).

**Recherche cloisonnée.** Chaque option a son moteur : la recherche du profil ne trouve
que ce que ce profil a publié, celle de la boutique que des articles, etc.
(`assets/js/core/search.js`). Micro intégré quand le navigateur gère la dictée.

**Globe.** Projection orthographique sur canvas, continents et frontières
(`assets/js/data/world.js`), couleurs naturelles, terminateur jour/nuit calculé depuis
l'heure UTC réelle et la saison, soleil en orbite autour du globe, heure GMT affichée
dessous. Un clic ouvre le menu des options en surcouche translucide : l'accueil reste
visible derrière, et choisir une option ferme le menu et y mène directement.

**Agent OWAK.** Un seul agent pour toute l'application, joignable partout, en panneau
compact posé dans la page (jamais plein écran) et visible du seul titulaire du compte.
Photo et nom libres, voix modulable, appels audio et vidéo. Il exécute de vraies
actions via un registre de commandes (`assets/js/core/actions.js`) : naviguer, publier,
enregistrer, suivre, écrire un message, changer un réglage, remplir ou vider le panier,
postuler, rejoindre un groupe, exporter les données. `Ctrl`+`K` l'ouvre.

**Enregistrement manuel.** Aucune modification n'est écrite avant une validation
explicite : les formulaires travaillent sur un brouillon, et seul `store.commit()`
persiste. Ce qui est enregistré le reste jusqu'à un nouveau changement.

**Médias.** Recadrage, zoom, rotation, miroir et format avant publication ; découpe pour
la vidéo. Le recadrage d'une image est réellement gravé dans un nouveau fichier ; pour
la vidéo il est conservé en métadonnées et appliqué à chaque rendu. Téléchargement
proposé partout où l'auteur l'autorise.

**Vidéos de démonstration.** Encodées dans le navigateur au premier lancement
(canvas + MediaRecorder, `assets/js/data/demoMedia.js`), donc la vitesse, le son, le
volume, la boucle et le saut agissent sur de vrais fichiers. Si l'encodage n'est pas
disponible, une affiche fixe générée prend le relais.

**Console concepteur.** Visible du seul compte concepteur, protégée par le code
`CALEB3011`, modifiable par lui seul dans Paramètres → Sécurité. Le bouton de réglage du
panneau publicitaire n'est rendu que pour ce compte, et la section n'apparaît ni dans le
menu ni ailleurs pour les autres.

## Arborescence

```
index.html, manifest.webmanifest, sw.js
assets/css/      base.css (jetons, mise en page, composants) · views.css (par vue)
assets/js/core/  dom, store, router, i18n, icons, ui, media, search, actions, idb
assets/js/data/  seed, world, demoMedia
assets/js/features/ globe, agent, parts
assets/js/views/ home, shorts, profile, messages, live, shop, misc, settings, owner
```

## Langues

Français, nouchi, anglais, espagnol, portugais, arabe (droite à gauche) et chinois.
Le changement s'applique à toute l'interface sans rechargement.

## Vérification

Parcours automatisé des 35 routes sur ordinateur, tablette et téléphone : aucune erreur
de console, aucune requête en échec, aucun débordement horizontal. 59 tests
fonctionnels couvrent le menu du globe, la flèche de retour, les recherches cloisonnées,
l'isolement des réglages du lecteur, la persistance après rechargement, les réglages,
l'agent et le verrou de la console.

## Limites assumées

- Les appels et le studio utilisent les flux réels de l'appareil (caméra, micro, écran)
  mais ne traversent pas le réseau : il n'y a pas de serveur de signalisation.
- Intégrée dans un cadre (page d'artefact), l'application prévient que le
  téléchargement n'est possible qu'en l'ouvrant dans son propre onglet, car le
  navigateur y refuse les téléchargements et les service workers.
- La dictée et la synthèse vocale dépendent du navigateur ; l'application le dit quand
  elles manquent au lieu de faire semblant.
