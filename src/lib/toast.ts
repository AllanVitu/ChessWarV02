import { reactive } from 'vue'

export type ToastTone = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  title: string
  message: string
  tone: ToastTone
}

type ToastState = {
  items: ToastItem[]
}

const state = reactive<ToastState>({
  items: [],
})

let toastId = 0

export const useToastState = () => state

export const pushToast = (toast: Omit<ToastItem, 'id'>, ttlMs = 3600): void => {
  const id = (toastId += 1)
  state.items = [...state.items, { ...toast, id }]
  setTimeout(() => {
    state.items = state.items.filter((item) => item.id !== id)
  }, ttlMs)
}

export const dismissToast = (id: number): void => {
  state.items = state.items.filter((item) => item.id !== id)
}

export const notifySuccess = (title: string, message: string) => {
  pushToast({ title, message, tone: 'success' })
}

export const notifyError = (title: string, message: string) => {
  pushToast({ title, message, tone: 'error' })
}

export const notifyInfo = (title: string, message: string) => {
  pushToast({ title, message, tone: 'info' })
}
