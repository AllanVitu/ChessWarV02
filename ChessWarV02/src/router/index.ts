import { createRouter, createWebHashHistory } from 'vue-router'

const IntroView = () => import('../views/IntroView.vue')
const LoginView = () => import('../views/LoginView.vue')
const RegisterView = () => import('../views/RegisterView.vue')
const ForgotPasswordView = () => import('../views/ForgotPasswordView.vue')
const HomeView = () => import('../views/HomeView.vue')
const MatchListView = () => import('../views/MatchListView.vue')
const StoryView = () => import('../views/StoryView.vue')
const StoryChapterView = () => import('../views/StoryChapterView.vue')
const GameView = () => import('../views/GameView.vue')
const LeaderboardView = () => import('../views/LeaderboardView.vue')
const ProfileView = () => import('../views/ProfileView.vue')
const ProfileAnalysisView = () => import('../views/ProfileAnalysisView.vue')
const UserProfileView = () => import('../views/UserProfileView.vue')
const FriendsView = () => import('../views/FriendsView.vue')
const SettingsView = () => import('../views/SettingsView.vue')
const HelpView = () => import('../views/HelpView.vue')
const PerfView = () => import('../views/PerfView.vue')
const NotFoundView = () => import('../views/NotFoundView.vue')

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      redirect: '/intro',
    },
    {
      path: '/intro',
      name: 'intro',
      component: IntroView,
      meta: {
        title: 'Accueil',
        description: "Decouvrez WarChess, l'arene d'echecs pour jouer et progresser rapidement.",
      },
    },
    {
      path: '/auth',
      name: 'auth',
      component: LoginView,
      alias: '/connexion',
      meta: {
        title: 'Connexion',
        description: 'Connectez-vous ou jouez en invite pour demarrer une partie.',
      },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: HomeView,
      alias: '/tableau-de-bord',
      meta: {
        title: 'Dashboard',
        description: 'Suivez vos performances, matchs et analyses recentes.',
      },
    },
    {
      path: '/matchs',
      name: 'matchs',
      component: MatchListView,
      alias: '/matches',
      meta: {
        title: 'Matchs',
        description: 'Creez et gerez vos parties en cours.',
      },
    },
    {
      path: '/histoire',
      name: 'histoire',
      component: StoryView,
      meta: {
        title: 'Mode histoire',
        description: 'Progressez dans une campagne de chapitres a difficulte croissante.',
      },
    },
    {
      path: '/histoire/:id',
      name: 'histoire-chapitre',
      component: StoryChapterView,
      meta: {
        title: 'Chapitre',
        description: 'Detail du chapitre et lancement de la mission.',
      },
    },
    {
      path: '/play/:id?',
      name: 'play',
      component: GameView,
      alias: '/jeu/:id?',
      meta: {
        title: 'Jouer',
        description: 'Lancez une partie locale ou en ligne.',
      },
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: LeaderboardView,
      alias: '/classement',
      meta: {
        title: 'Classement',
        description: 'Comparez vos performances avec les meilleurs joueurs.',
      },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      alias: '/profil',
      meta: {
        title: 'Profil',
        description: 'Gerez vos informations et la securite du compte.',
      },
    },
    {
      path: '/amis',
      name: 'amis',
      component: FriendsView,
      meta: {
        title: 'Amis',
        description: 'Invitez et suivez vos partenaires de jeu.',
      },
    },
    {
      path: '/joueur/:id',
      name: 'joueur',
      component: UserProfileView,
      meta: {
        title: 'Profil joueur',
        description: 'Consultez les statistiques publiques.',
      },
    },
    {
      path: '/profil/analyse',
      name: 'profil-analyse',
      component: ProfileAnalysisView,
      meta: {
        title: 'Analyse',
        description: "Analysez votre progression sur la saison.",
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: SettingsView,
      alias: '/parametres',
      meta: {
        title: 'Parametres',
        description: "Ajustez l'interface, les notifications et la confidentialite.",
      },
    },
    {
      path: '/inscription',
      name: 'inscription',
      component: RegisterView,
      alias: '/auth/inscription',
      meta: {
        title: 'Inscription',
        description: 'Creez un compte WarChess.',
      },
    },
    {
      path: '/mot-de-passe-oublie',
      name: 'mot-de-passe-oublie',
      component: ForgotPasswordView,
      alias: '/auth/mot-de-passe-oublie',
      meta: {
        title: 'Mot de passe',
        description: 'Reinitialisez votre acces au compte.',
      },
    },
    {
      path: '/help',
      name: 'help',
      component: HelpView,
      alias: '/aide',
      meta: {
        title: 'Aide',
        description: 'Regles, FAQ et conseils pour bien demarrer.',
      },
    },
    {
      path: '/perf',
      name: 'perf',
      component: PerfView,
      alias: '/diagnostics',
      meta: {
        title: 'Diagnostics',
        description: 'Mesures de performance et erreurs client.',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundView,
      meta: {
        title: 'Page introuvable',
        description: "La page demandee n'existe pas.",
      },
    },
  ],
})

router.beforeEach((to) => {
  if (to.name !== 'play') return true
  const hasId = typeof to.params.id === 'string' && to.params.id.length > 0
  const allowQuery = typeof to.query.allow === 'string' && to.query.allow === '1'
  let allowSession = false
  if (typeof window !== 'undefined') {
    try {
      allowSession = window.sessionStorage.getItem('warchess.play.access') === '1'
      if (allowSession) {
        window.sessionStorage.removeItem('warchess.play.access')
      }
    } catch {
      allowSession = false
    }
  }
  if (hasId || allowQuery || allowSession) return true
  return { path: '/matchs' }
})

export default router
