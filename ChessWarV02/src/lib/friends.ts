import { apiFetch } from './api'

export type FriendProfile = {
  id: string
  name: string
  title: string
  rating: number
  location: string
  lastSeen: string
  isOnline?: boolean
}

export type FriendRequestItem = {
  id: string
  createdAt: string
  user: {
    id: string
    name: string
    title: string
    rating: number
  }
}

export type FriendsOverview = {
  friends: FriendProfile[]
  incoming: FriendRequestItem[]
  outgoing: FriendRequestItem[]
}

export const getFriendsOverview = async (): Promise<FriendsOverview> => {
  const response = await apiFetch<{
    ok: boolean
    friends?: FriendProfile[]
    incoming?: FriendRequestItem[]
    outgoing?: FriendRequestItem[]
  }>('friends-list')

  return {
    friends: response.friends ?? [],
    incoming: response.incoming ?? [],
    outgoing: response.outgoing ?? [],
  }
}
