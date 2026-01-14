<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import {
  getPublicProfile,
  requestFriend,
  respondFriendRequest,
  type PublicProfile,
} from '@/lib/users'
import { createMatchInvite } from '@/lib/notifications'

const route = useRoute()
const profile = ref<PublicProfile | null>(null)
const loading = ref(false)
const loadError = ref('')

const actionMessage = ref('')
const actionError = ref(false)
const matchMessage = ref('')
const matchError = ref(false)

const userId = computed(() => String(route.params.id ?? ''))

const friendStatus = computed(() => profile.value?.friendStatus ?? 'none')
const isSelf = computed(() => friendStatus.value === 'self')
const isFriends = computed(() => friendStatus.value === 'friends')
const isOutgoing = computed(() => friendStatus.value === 'outgoing')
const isIncoming = computed(() => friendStatus.value === 'incoming')

const initials = computed(() => {
  const name = profile.value?.name?.trim() ?? ''
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
})


const resetMessages = () => {
  actionMessage.value = ''
  actionError.value = false
  matchMessage.value = ''
  matchError.value = false
}

const loadProfile = async () => {
  resetMessages()
  loadError.value = ''
  profile.value = null
  const targetId = userId.value
  if (!targetId) {
    loadError.value = 'Profil introuvable.'
    return
  }

  loading.value = true
  try {
    const data = await getPublicProfile(targetId)
    if (!data) {
      loadError.value = 'Profil introuvable.'
    } else {
      profile.value = data
    }
  } catch (error) {
    loadError.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

const handleFriendRequest = async () => {
  if (!profile.value) return
  resetMessages()
  try {
    const response = await requestFriend(profile.value.id)
    actionMessage.value = response.message
    actionError.value = !response.ok
    if (response.ok) {
      profile.value.friendStatus = response.friendStatus
    }
  } catch (error) {
    actionMessage.value = (error as Error).message
    actionError.value = true
  }
}

const handleAcceptFriend = async () => {
  if (!profile.value) return
  resetMessages()
  try {
    const response = await respondFriendRequest(profile.value.id, 'accept')
    actionMessage.value = response.message
    actionError.value = !response.ok
    if (response.ok) {
      profile.value.friendStatus = response.friendStatus
    }
  } catch (error) {
    actionMessage.value = (error as Error).message
    actionError.value = true
  }
}

const handleDeclineFriend = async () => {
  if (!profile.value) return
  resetMessages()
  try {
    const response = await respondFriendRequest(profile.value.id, 'decline')
    actionMessage.value = response.message
    actionError.value = !response.ok
    if (response.ok) {
      profile.value.friendStatus = response.friendStatus
    }
  } catch (error) {
    actionMessage.value = (error as Error).message
    actionError.value = true
  }
}

const handleLaunchMatch = async () => {
  if (!profile.value) return
  resetMessages()

  if (!isFriends.value) {
    matchMessage.value = 'Ajoutez ce joueur en ami pour lancer un match.'
    matchError.value = true
    return
  }

  try {
    const response = await createMatchInvite(profile.value.id)
    matchMessage.value = response.message
    matchError.value = !response.ok
  } catch (error) {
    matchMessage.value = (error as Error).message
    matchError.value = true
  }
}

watch(userId, loadProfile, { immediate: true })
</script>

<template>
  <DashboardLayout
    eyebrow="Joueur"
    :title="profile?.name ?? 'Profil joueur'"
    :subtitle="profile?.title || 'Profil public'"
  >
    <section class="profile-public-grid">
      <div v-if="loading" class="panel profile-card">
        <p class="panel-title">Chargement</p>
        <p class="panel-sub">Recuperation du profil en cours.</p>
      </div>

      <div v-else-if="loadError" class="panel profile-card">
        <p class="form-message form-message--error">{{ loadError }}</p>
      </div>

      <div v-else-if="profile" class="panel profile-card profile-public">
        <div class="panel-header profile-public-header">
          <div>
            <p class="panel-title">Profil public</p>
            <h2 class="panel-headline">{{ profile.name }}</h2>
            <p class="panel-sub">{{ profile.motto || 'Aucune devise renseignee.' }}</p>
          </div>
          <div class="public-avatar">{{ initials }}</div>
        </div>

        <div class="public-stats">
          <div class="stat-chip">
            <span class="stat-chip-label">Elo</span>
            <span class="stat-chip-value">{{ profile.rating }}</span>
          </div>
          <div class="stat-chip">
            <span class="stat-chip-label">Localisation</span>
            <span class="stat-chip-value">{{ profile.location || 'Non renseignee' }}</span>
          </div>
          <div class="stat-chip">
            <span class="stat-chip-label">Derniere activite</span>
            <span class="stat-chip-value">{{ profile.lastSeen || 'Non renseignee' }}</span>
          </div>
        </div>

        <div v-if="!isSelf" class="public-actions">
          <button
            v-if="friendStatus === 'none'"
            class="button-primary"
            type="button"
            @click="handleFriendRequest"
          >
            Demander en ami
          </button>
          <button v-else-if="isOutgoing" class="button-ghost" type="button" disabled>
            Demande envoyee
          </button>
          <div v-else-if="isIncoming" class="public-action-group">
            <button class="button-primary" type="button" @click="handleAcceptFriend">
              Accepter
            </button>
            <button class="button-ghost" type="button" @click="handleDeclineFriend">
              Refuser
            </button>
          </div>
          <button v-else-if="isFriends" class="button-ghost" type="button" disabled>
            Deja amis
          </button>

          <button
            class="button-primary"
            type="button"
            :disabled="!isFriends"
            @click="handleLaunchMatch"
          >
            Lancer un match
          </button>
        </div>

        <p
          v-if="actionMessage"
          :class="['form-message', actionError ? 'form-message--error' : 'form-message--success']"
        >
          {{ actionMessage }}
        </p>

        <p
          v-if="matchMessage"
          :class="['form-message', matchError ? 'form-message--error' : 'form-message--success']"
        >
          {{ matchMessage }}
        </p>
      </div>
    </section>
  </DashboardLayout>
</template>
