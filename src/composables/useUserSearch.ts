import { ref, watch, type Ref } from 'vue'
import { getSessionToken } from '@/lib/api'
import { searchUsers, type UserSearchItem } from '@/lib/users'

export function useUserSearch() {
  const query = ref('')
  const results = ref<UserSearchItem[]>([])
  const loading = ref(false)
  const message = ref('')
  const open = ref(false)
  const groupRef = ref<HTMLElement | null>(null)
  const minLength = 2
  let timer: ReturnType<typeof setTimeout> | null = null
  let requestId = 0

  const reset = () => {
    results.value = []
    loading.value = false
    message.value = ''
  }

  const run = async (q: string) => {
    if (!getSessionToken()) {
      message.value = 'Connectez-vous pour rechercher.'
      results.value = []
      loading.value = false
      return
    }

    const id = (requestId += 1)
    loading.value = true
    message.value = ''

    try {
      const data = await searchUsers(q)
      if (id !== requestId) return
      results.value = data
      if (!data.length) message.value = 'Aucun joueur trouve.'
    } catch (err) {
      if (id !== requestId) return
      message.value = (err as Error).message
      results.value = []
    } finally {
      if (id === requestId) loading.value = false
    }
  }

  watch(query, (value) => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    const trimmed = value.trim()
    if (trimmed.length < minLength) {
      reset()
      return
    }
    timer = setTimeout(() => {
      void run(trimmed)
    }, 320)
  })

  const initialsFor = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return '?'
    return (
      trimmed
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('') || '?'
    )
  }

  const onlineLabel = (user: UserSearchItem) => {
    if (user.isOnline === true) return 'En ligne'
    if (user.isOnline === false) return 'Hors ligne'
    return 'Statut inconnu'
  }

  const onlineClass = (user: UserSearchItem) => {
    if (user.isOnline === true) return 'presence-dot--online'
    if (user.isOnline === false) return 'presence-dot--offline'
    return 'presence-dot--unknown'
  }

  const dispose = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return {
    query,
    results,
    loading,
    message,
    open,
    groupRef,
    reset,
    run,
    initialsFor,
    onlineLabel,
    onlineClass,
    dispose,
  }
}
