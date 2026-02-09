<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import DashboardLayout from '@/components/DashboardLayout.vue'
import { clearMatchesCache } from '@/lib/matchesDb'
import { getFriendsOverview, type FriendProfile, type FriendRequestItem } from '@/lib/friends'
import { cancelFriendRequest, removeFriend, respondFriendRequest } from '@/lib/users'
import {
  createMatchInvite,
  getNotifications,
  markNotificationsRead,
  respondMatchInvite,
  type MatchInviteNotification,
} from '@/lib/notifications'

const router = useRouter()
const friends = ref<FriendProfile[]>([])
const incomingRequests = ref<FriendRequestItem[]>([])
const outgoingRequests = ref<FriendRequestItem[]>([])
const matchInvites = ref<MatchInviteNotification[]>([])
const loading = ref(false)
const errorMessage = ref('')
const friendNotice = ref('')
const friendNoticeError = ref(false)
const inviteNotice = ref('')
const inviteNoticeError = ref(false)
const friendsPage = ref(1)
const friendsPageSize = 6

const visibleFriends = computed(() =>
  friends.value.slice(0, friendsPage.value * friendsPageSize),
)
const canLoadMoreFriends = computed(
  () => visibleFriends.value.length < friends.value.length,
)

watch(friends, () => {
  friendsPage.value = 1
})

const initialsFor = (name: string) => {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

const hasOnlineStatus = (friend: FriendProfile) => typeof friend.isOnline === 'boolean'
const isOnline = (friend: FriendProfile) => friend.isOnline === true
const onlineLabel = (friend: FriendProfile) => {
  if (!hasOnlineStatus(friend)) return 'Statut inconnu'
  return isOnline(friend) ? 'En ligne' : 'Hors ligne'
}
const canInvite = (friend: FriendProfile) => !hasOnlineStatus(friend) || isOnline(friend)

const resetNotices = () => {
  friendNotice.value = ''
  friendNoticeError.value = false
  inviteNotice.value = ''
  inviteNoticeError.value = false
}

const loadFriends = async () => {
  const data = await getFriendsOverview()
  friends.value = data.friends
  incomingRequests.value = data.incoming
  outgoingRequests.value = data.outgoing
}

const loadInvites = async () => {
  const data = await getNotifications()
  matchInvites.value = data.matchInvites
}

const loadAll = async () => {
  resetNotices()
  errorMessage.value = ''
  loading.value = true
  try {
    await Promise.all([loadFriends(), loadInvites()])
  } catch (error) {
    errorMessage.value = (error as Error).message
  } finally {
    loading.value = false
  }
}

const handleFriendResponse = async (request: FriendRequestItem, action: 'accept' | 'decline') => {
  resetNotices()
  try {
    const response = await respondFriendRequest(request.user.id, action)
    friendNotice.value = response.message
    friendNoticeError.value = !response.ok
    if (response.ok) {
      await loadFriends()
    }
  } catch (error) {
    friendNotice.value = (error as Error).message
    friendNoticeError.value = true
  }
}

const handleInviteMatch = async (friend: FriendProfile) => {
  resetNotices()
  try {
    const response = await createMatchInvite(friend.id)
    inviteNotice.value = response.message
    inviteNoticeError.value = !response.ok
    if (response.ok && response.status === 'accepted' && response.matchId) {
      clearMatchesCache()
      await router.push(`/jeu/${response.matchId}`)
    }
  } catch (error) {
    inviteNotice.value = (error as Error).message
    inviteNoticeError.value = true
  }
}

const handleCancelRequest = async (request: FriendRequestItem) => {
  resetNotices()
  try {
    const response = await cancelFriendRequest(request.user.id)
    friendNotice.value = response.message
    friendNoticeError.value = !response.ok
    if (response.ok) {
      await loadFriends()
    }
  } catch (error) {
    friendNotice.value = (error as Error).message
    friendNoticeError.value = true
  }
}

const handleRemoveFriend = async (friend: FriendProfile) => {
  resetNotices()
  try {
    const response = await removeFriend(friend.id)
    friendNotice.value = response.message
    friendNoticeError.value = !response.ok
    if (response.ok) {
      await loadFriends()
    }
  } catch (error) {
    friendNotice.value = (error as Error).message
    friendNoticeError.value = true
  }
}

const handleMatchResponse = async (
  invite: MatchInviteNotification,
  action: 'accept' | 'decline',
) => {
  resetNotices()
  try {
    const response = await respondMatchInvite(invite.id, action)
    inviteNotice.value = response.message
    inviteNoticeError.value = !response.ok
    if (response.ok) {
      await loadInvites()
      if (action === 'accept' && response.matchId) {
        clearMatchesCache()
        await router.push(`/jeu/${response.matchId}`)
      }
    }
  } catch (error) {
    inviteNotice.value = (error as Error).message
    inviteNoticeError.value = true
  }
}

onMounted(() => {
  void loadAll()
  markNotificationsRead('all').catch(() => {})
})
</script>

<template>
  <DashboardLayout
    eyebrow="Social"
    title="Mes amis"
    subtitle="Gerez vos amis, vos demandes et les invitations de match."
  >
    <section class="content-grid">
      <div class="left-column">
        <div class="panel friends-card">
          <div class="panel-header">
            <div>
              <p class="panel-title">Amis</p>
              <h3 class="panel-headline">Votre cercle de joueurs</h3>
            </div>
            <span class="badge-soft">{{ friends.length }} amis</span>
          </div>

          <p v-if="loading" class="panel-sub">Chargement des amis...</p>
          <p v-else-if="errorMessage" class="form-message form-message--error">
            {{ errorMessage }}
          </p>

          <div v-else class="friends-list">
            <article v-for="friend in visibleFriends" :key="friend.id" class="friend-row">
              <div class="friend-ident">
                <div class="friend-avatar">{{ initialsFor(friend.name) }}</div>
                <div>
                  <p class="friend-name">{{ friend.name }}</p>
                  <p class="friend-meta">{{ friend.title || 'Profil public' }}</p>
                </div>
              </div>
              <div class="friend-chips">
                <span class="friend-chip">Elo {{ friend.rating }}</span>
                <span
                  :class="[
                    'friend-chip',
                    hasOnlineStatus(friend)
                      ? isOnline(friend)
                        ? 'friend-chip--online'
                        : 'friend-chip--offline'
                      : 'friend-chip--unknown',
                  ]"
                >
                  {{ onlineLabel(friend) }}
                </span>
                <span class="friend-chip">{{ friend.location || 'Localisation inconnue' }}</span>
                <span class="friend-chip">{{ friend.lastSeen || 'Derniere activite inconnue' }}</span>
              </div>
              <div class="friend-actions">
                <RouterLink class="button-ghost" :to="`/joueur/${friend.id}`">Voir</RouterLink>
                <button
                  class="button-primary"
                  type="button"
                  :disabled="!canInvite(friend)"
                  @click="handleInviteMatch(friend)"
                >
                  {{ canInvite(friend) ? 'Inviter' : 'Indisponible' }}
                </button>
                <button class="button-ghost" type="button" @click="handleRemoveFriend(friend)">
                  Retirer
                </button>
              </div>
            </article>

            <div v-if="!friends.length && !loading" class="empty-state">
              <p class="empty-state__title">Aucun ami pour le moment.</p>
              <p class="empty-state__subtitle">Invitez un joueur pour lancer un match.</p>
              <RouterLink class="button-primary" to="/leaderboard">Trouver un joueur</RouterLink>
            </div>
            <button
              v-else-if="canLoadMoreFriends"
              class="button-ghost"
              type="button"
              @click="friendsPage += 1"
            >
              Afficher plus
            </button>
          </div>

          <p
            v-if="inviteNotice"
            :class="['form-message', inviteNoticeError ? 'form-message--error' : 'form-message--success']"
          >
            {{ inviteNotice }}
          </p>
        </div>
      </div>

      <aside class="right-column">
        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Demandes d'amis</p>
              <h3 class="panel-headline">En attente</h3>
            </div>
          </div>

          <div class="friends-request-list">
            <div v-for="request in incomingRequests" :key="request.id" class="request-row">
              <div class="request-info">
                <div class="friend-avatar">{{ initialsFor(request.user.name) }}</div>
                <div>
                  <p class="friend-name">{{ request.user.name }}</p>
                  <p class="friend-meta">{{ request.user.title || 'Profil public' }}</p>
                </div>
              </div>
              <div class="request-actions">
                <button class="button-primary" type="button" @click="handleFriendResponse(request, 'accept')">
                  Accepter
                </button>
                <button class="button-ghost" type="button" @click="handleFriendResponse(request, 'decline')">
                  Refuser
                </button>
              </div>
            </div>

            <div v-for="request in outgoingRequests" :key="request.id" class="request-row request-row--outgoing">
              <div class="request-info">
                <div class="friend-avatar">{{ initialsFor(request.user.name) }}</div>
                <div>
                  <p class="friend-name">{{ request.user.name }}</p>
                  <p class="friend-meta">Demande envoyee</p>
                </div>
              </div>
              <button class="button-ghost" type="button" @click="handleCancelRequest(request)">
                Annuler
              </button>
            </div>
          </div>

          <p v-if="!incomingRequests.length && !outgoingRequests.length" class="empty-state">
            Aucune demande en cours.
          </p>

          <p
            v-if="friendNotice"
            :class="['form-message', friendNoticeError ? 'form-message--error' : 'form-message--success']"
          >
            {{ friendNotice }}
          </p>
        </div>

        <div class="panel">
          <div class="panel-header">
            <div>
              <p class="panel-title">Invitations de match</p>
              <h3 class="panel-headline">En cours</h3>
            </div>
          </div>

          <div class="friends-request-list">
            <div v-for="invite in matchInvites" :key="invite.id" class="request-row">
              <div class="request-info">
                <div class="friend-avatar">{{ initialsFor(invite.from.name) }}</div>
                <div>
                  <p class="friend-name">{{ invite.from.name }}</p>
                  <p class="friend-meta">Cadence {{ invite.timeControl }}</p>
                </div>
              </div>
              <div class="request-actions">
                <button class="button-primary" type="button" @click="handleMatchResponse(invite, 'accept')">
                  Accepter
                </button>
                <button class="button-ghost" type="button" @click="handleMatchResponse(invite, 'decline')">
                  Refuser
                </button>
              </div>
            </div>
          </div>

          <p v-if="!matchInvites.length" class="empty-state">Aucune invitation.</p>
        </div>
      </aside>
    </section>
  </DashboardLayout>
</template>
