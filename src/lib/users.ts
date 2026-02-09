import { apiFetch } from './api'
import { enqueueAction, isNetworkError, isOffline } from './offlineQueue'

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends' | 'self'

export type UserSearchItem = {
  id: string
  name: string
  title: string
  rating: number
  location: string
  isOnline?: boolean
}

export type PublicProfile = {
  id: string
  name: string
  title: string
  rating: number
  motto: string
  location: string
  lastSeen: string
  isOnline?: boolean
  friendStatus: FriendStatus
}

export type UserBadge = {
  key: string
  label: string
  description: string
  value: string
  earned: boolean
}

type FriendResponse = {
  ok: boolean
  message: string
  friendStatus: FriendStatus
}

export const searchUsers = async (query: string): Promise<UserSearchItem[]> => {
  const response = await apiFetch<{ ok: boolean; users?: UserSearchItem[] }>(
    `users-search?q=${encodeURIComponent(query)}`,
    { cacheTtlMs: 10000 },
  )

  if (!response.ok) return []
  return response.users ?? []
}

export const getPublicProfile = async (userId: string): Promise<PublicProfile | null> => {
  const response = await apiFetch<{
    ok: boolean
    profile?: Omit<PublicProfile, 'friendStatus'>
    friendStatus?: FriendStatus
  }>(`users-profile?id=${encodeURIComponent(userId)}`, { cacheTtlMs: 60000 })

  if (!response.ok || !response.profile) return null

  return {
    ...response.profile,
    friendStatus: response.friendStatus ?? 'none',
  }
}

export const getUserBadges = async (userId: string): Promise<UserBadge[]> => {
  const response = await apiFetch<{ ok: boolean; badges?: UserBadge[] }>(
    `users-badges?id=${encodeURIComponent(userId)}`,
    { cacheTtlMs: 60000 },
  )

  if (!response.ok) return []
  return response.badges ?? []
}

export const requestFriend = async (userId: string): Promise<FriendResponse> => {
  if (isOffline()) {
    await enqueueAction('friend-request', { userId })
    return {
      ok: true,
      message: "Demande d'ami en attente de connexion.",
      friendStatus: 'outgoing',
    }
  }

  try {
    return await apiFetch<FriendResponse>('friends-request', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    })
  } catch (error) {
    if (isNetworkError(error) || isOffline()) {
      await enqueueAction('friend-request', { userId })
      return {
        ok: true,
        message: "Demande d'ami en attente de connexion.",
        friendStatus: 'outgoing',
      }
    }
    throw error
  }
}

export const respondFriendRequest = async (
  userId: string,
  action: 'accept' | 'decline',
): Promise<FriendResponse> => {
  return apiFetch<FriendResponse>('friends-respond', {
    method: 'POST',
    body: JSON.stringify({ userId, action }),
  })
}

export const cancelFriendRequest = async (userId: string): Promise<FriendResponse> => {
  return apiFetch<FriendResponse>('friends-cancel', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}

export const removeFriend = async (userId: string): Promise<FriendResponse> => {
  return apiFetch<FriendResponse>('friends-remove', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
}
