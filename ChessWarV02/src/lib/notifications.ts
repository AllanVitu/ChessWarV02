import { apiFetch } from './api'

export type FriendRequestNotification = {
  id: string
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
  }>('notifications-get')

  return {
    friendRequests: response.friendRequests ?? [],
    matchInvites: response.matchInvites ?? [],
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
