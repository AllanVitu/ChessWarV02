import { apiFetch } from './api'

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends' | 'self'

export type UserSearchItem = {
  id: string
  name: string
  title: string
  rating: number
  location: string
}

export type PublicProfile = {
  id: string
  name: string
  title: string
  rating: number
  motto: string
  location: string
  lastSeen: string
  friendStatus: FriendStatus
}

type FriendResponse = {
  ok: boolean
  message: string
  friendStatus: FriendStatus
}

export const searchUsers = async (query: string): Promise<UserSearchItem[]> => {
  const response = await apiFetch<{ ok: boolean; users?: UserSearchItem[] }>(
    `users-search?q=${encodeURIComponent(query)}`,
  )

  if (!response.ok) return []
  return response.users ?? []
}

export const getPublicProfile = async (userId: string): Promise<PublicProfile | null> => {
  const response = await apiFetch<{
    ok: boolean
    profile?: Omit<PublicProfile, 'friendStatus'>
    friendStatus?: FriendStatus
  }>(`users-profile?id=${encodeURIComponent(userId)}`)

  if (!response.ok || !response.profile) return null

  return {
    ...response.profile,
    friendStatus: response.friendStatus ?? 'none',
  }
}

export const requestFriend = async (userId: string): Promise<FriendResponse> => {
  return apiFetch<FriendResponse>('friends-request', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  })
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
