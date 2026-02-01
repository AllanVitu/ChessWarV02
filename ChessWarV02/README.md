# WarChess

SPA d'echecs premium (Vue 3 + Vite) avec dashboard, parties, classements et analyse. Optimisee pour mobile, performance et accessibilite.

## Routes principales
- `/#/intro` Landing
- `/#/auth` Connexion / invite
- `/#/dashboard` Tableau de bord
- `/#/matchs` Centre des matchs
- `/#/play` Partie (cachee, uniquement apres creation d'un match)
- `/#/leaderboard` Classement
- `/#/profile` Profil
- `/#/settings` Parametres
- `/#/studio` Atelier / modules
- `/#/help` Regles / FAQ

## Demarrer
```sh
npm install
npm run dev
```

## Build
```sh
npm run build
npm run preview
```

## Variables d'environnement
- `VITE_API_BASE` URL API (ex: `/api`)
- `VITE_SITE_URL` domaine canonical (ex: `https://warchess.app`)
- `VITE_ANALYTICS_ENDPOINT` endpoint analytics (facultatif)
- `VITE_ERROR_ENDPOINT` endpoint erreurs (facultatif)

## Deploiement
### Neon + Netlify
1) Creez une base Neon et executez `database/schema.sql`.
2) Dans Netlify, ajoutez `DATABASE_URL`.
3) Build: `npm run build`, publish: `dist`.

### O2Switch (PostgreSQL + PHP)
1) Creez une base PostgreSQL dans cPanel.
2) Importez `database/schema-o2switch-postgres.sql`.
3) Configurez `public/api/_shared/config.php` ou les variables d'environnement.
4) Deployer `dist` a la racine du domaine.

## SEO / partage
- Mettre a jour `https://warchess.app` dans `index.html`, `public/robots.txt`, `public/sitemap.xml`.
- OG image par defaut: `/icon-512.png` (remplacez par un visuel 1200x630 si besoin).

## Intro loader (preload)
Le loader de `/intro` precharge une liste d'assets et fournit une progression realiste.

### Ajouter un asset au manifest
Dans `src/views/IntroView.vue`, ajoutez un item dans `assets`:
```ts
{ url: someUrl, label: 'Nom', weight: 1, heavy: true }
```
- `weight` ajuste le poids dans le calcul du pourcentage.
- `heavy: true` est ignore en mode leger.

### Tester les fallbacks
1) **Simuler un 404**: modifiez temporairement une URL d'asset vers un fichier inexistant.
2) **Simuler hors-ligne**: utilisez l'onglet Network > Offline dans les DevTools.
3) **Simuler ChunkLoadError**: bloquez un chunk via DevTools ou renommez un fichier `dist/assets/*.js`.

## Checklist de validation
- Landing visible en < 200ms avec loader.
- H1 + promesse + CTA "Lancer un match" sur `/intro`.
- Mode invite accessible depuis `/auth` et `/intro`.
- Bottom nav mobile actif.
- Etats UI: hover/active/disabled/loading.
- Accessibilite: clavier, focus visible, aria-live sur toasts.
- Lighthouse cible: Perf > 90, A11y > 90, SEO > 90.
- OG preview OK (Discord/WhatsApp).
- 404 et offline banner affiches.
