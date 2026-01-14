import { apiFetch } from './api'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

export type FriendRequestNotification = {
  id: string
  isNew: boolean
  user: {
    id: string
    name: string
    title: string
    rating: number
  }
}

export type MatchInviteNotification = {
  id: string
  matchId: string
  timeControl: string
  createdAt: string
  isNew: boolean
  from: {
    id: string
    name: string
    title: string
    rating: number
  }
}

export type MatchReadyNotification = {
  id: string
  matchId: string
  timeControl: string
  acceptedAt: string
  isNew: boolean
  from: {
    id: string
    name: string
    title: string
    rating: number
  }
}

export type NotificationsPayload = {
  friendRequests: FriendRequestNotification[]
  matchInvites: MatchInviteNotification[]
  matchReady: MatchReadyNotification[]
}

type MatchInviteResponse = {
  ok: boolean
  message: string
  inviteId?: string
  matchId?: string
}

export const getNotifications = async (): Promise<NotificationsPayload> => {
  const response = await apiFetch<{
    ok: boolean
    friendRequests?: FriendRequestNotification[]
    matchInvites?: MatchInviteNotification[]
    matchReady?: MatchReadyNotification[]
  }>('notifications-get')

  return {
    friendRequests: (response.friendRequests ?? []).map((request) => ({
      ...request,
      isNew: request.isNew ?? false,
    })),
    matchInvites: (response.matchInvites ?? []).map((invite) => ({
      ...invite,
      isNew: invite.isNew ?? false,
    })),
    matchReady: (response.matchReady ?? []).map((ready) => ({
      ...ready,
      isNew: ready.isNew ?? false,
    })),
  }
}

export const createMatchInvite = async (
  userId: string,
  timeControl = '10+0',
  requesterSide = 'Aleatoire',
): Promise<MatchInviteResponse> => {
  return apiFetch<MatchInviteResponse>('match-invite-create', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      timeControl,
      requesterSide,
    }),
  })
}

export const respondMatchInvite = async (
  inviteId: string,
  action: 'accept' | 'decline',
): Promise<MatchInviteResponse> => {
  return apiFetch<MatchInviteResponse>('match-invite-respond', {
    method: 'POST',
    body: JSON.stringify({ inviteId, action }),
  })
}

export const markNotificationsRead = async (
  type: 'friends' | 'matches' | 'match-ready' | 'all' = 'all',
) => {
  return apiFetch<{ ok: boolean; message: string }>('notifications-read', {
    method: 'POST',
    body: JSON.stringify({ type }),
  })
}

export const openNotificationsStream = (
  token: string,
  onMessage: (payload: NotificationsPayload) => void,
  onError?: (event: Event) => void,
): EventSource => {
  const source = new EventSource(
    `${API_BASE}/notifications-stream?token=${encodeURIComponent(token)}`,
  )

  source.addEventListener('notifications', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent).data) as NotificationsPayload
      onMessage({
        friendRequests: (data.friendRequests ?? []).map((request) => ({
          ...request,
          isNew: request.isNew ?? false,
        })),
        matchInvites: (data.matchInvites ?? []).map((invite) => ({
          ...invite,
          isNew: invite.isNew ?? false,
        })),
        matchReady: (data.matchReady ?? []).map((ready) => ({
          ...ready,
          isNew: ready.isNew ?? false,
        })),
      })
    } catch {
      // Ignore malformed payloads.
    }
  })

  if (onError) {
    source.addEventListener('error', onError)
  }

  return source
}
