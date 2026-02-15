# WarChess

Application d echecs premium (Vue 3 + Vite) avec mode histoire, matchmaking JcJ temps reel et dashboard analytique.

## Routes principales
- `/#/intro` Landing
- `/#/auth` Connexion / invite
- `/#/dashboard` Tableau de bord
- `/#/matchs` Centre des matchs
- `/#/play` Partie (cachee, uniquement apres creation d un match)
- `/#/leaderboard` Classement
- `/#/profile` Profil
- `/#/profil/analyse` Analyse du profil
- `/#/settings` Parametres
- `/#/histoire` Campagne
- `/#/histoire/:id` Detail chapitre
- `/#/help` Regles / FAQ

## Etats de match JcJ
- `waiting` : salle creee, attente des joueurs
- `ready` : les deux joueurs sont prets, compte a rebours serveur
- `started` : partie en cours, chrono server time
- `finished` : partie terminee (mate, nulle, abandon, timeout)
- `aborted` : annule (deconnexion avant demarrage)

## Endpoints API (principaux)
### Auth
- `POST /api/auth-register`
- `POST /api/auth-login`
- `POST /api/auth-logout`
- `GET /api/auth-session`

### Dashboard
- `GET /api/dashboard-get`
- `POST /api/dashboard-save`

### Matchs JcJ
- `GET /api/matches-get`
- `POST /api/matches-add`
- `POST /api/matches-clear`

### Match realtime
- `GET /api/match-room-get?matchId=...`
- `GET /api/match-stream?matchId=...&token=...`
- `POST /api/match-ready`
- `POST /api/match-presence`
- `POST /api/match-move-add`
- `POST /api/match-finish`

### Matchmaking
- `POST /api/matchmake-join`
- `GET /api/matchmake-status`
- `POST /api/matchmake-leave`

### Classement
- `GET /api/leaderboard-get?scope=global|monthly|friends&page=1&pageSize=20`

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

## Variables d environnement
- `VITE_API_BASE` URL API (ex: `/api`)
- `VITE_WS_BASE` URL WebSocket (facultatif)
- `VITE_MATCH_TRANSPORT` transport match (`auto`, `ws`, `sse`, `poll`) pour forcer un seul canal temps reel
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
3) Configurez `public/api/_shared/config.php` ou les variables d environnement.
4) Deployer `dist` a la racine du domaine.

## Notes de migration
- La table `matches` utilise une cle composite `(user_id, id)`.
- `match_rooms` expose `ready_at`, `start_at`, `finished_at`, `aborted_at`, `*_ready_at`, `*_seen_at`.
- La table `match_moves` inclut `promotion` (TEXT NULL) pour les coups de promotion.
- Ajouter les tables `match_queue` et les index associes.

## Checklist de validation
- Deux joueurs lancent un match => demarrage synchronise au countdown serveur.
- Refresh en cours => reprise avec temps restant correct.
- Deconnexion pendant `ready` => `aborted`.
- Fin au temps => `finished` sur les deux clients.
