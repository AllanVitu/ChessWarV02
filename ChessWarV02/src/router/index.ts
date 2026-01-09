import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import MatchListView from '../views/MatchListView.vue'
import GameView from '../views/GameView.vue'
import ProfileView from '../views/ProfileView.vue'
import ProfileAnalysisView from '../views/ProfileAnalysisView.vue'
import SettingsView from '../views/SettingsView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'connexion',
      component: LoginView,
      alias: '/connexion',
    },
    {
      path: '/tableau-de-bord',
      name: 'dashboard',
      component: HomeView,
    },
    {
      path: '/matchs',
      name: 'matchs',
      component: MatchListView,
    },
    {
      path: '/jeu/:id?',
      name: 'jeu',
      component: GameView,
    },
    {
      path: '/profil',
      name: 'profil',
      component: ProfileView,
    },
    {
      path: '/profil/analyse',
      name: 'profil-analyse',
      component: ProfileAnalysisView,
    },
    {
      path: '/parametres',
      name: 'parametres',
      component: SettingsView,
    },
    {
      path: '/inscription',
      name: 'inscription',
      component: RegisterView,
    },
    {
      path: '/mot-de-passe-oublie',
      name: 'mot-de-passe-oublie',
      component: ForgotPasswordView,
    },
  ],
})

export default router
