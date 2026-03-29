// 简单的全局通知 store
type NotificationType = 'success' | 'info' | 'warning'

interface Notification {
  id: string
  type: NotificationType
  message: string
  createdAt: number
}

let listeners: Set<(notifications: Notification[]) => void> = new Set()
let notifications: Notification[] = []

export const notificationStore = {
  add(type: NotificationType, message: string) {
    const notification: Notification = {
      id: Date.now().toString(),
      type,
      message,
      createdAt: Date.now(),
    }
    notifications = [...notifications, notification]
    listeners.forEach(fn => fn(notifications))
    // 自动 5 秒后移除
    setTimeout(() => {
      notificationStore.remove(notification.id)
    }, 5000)
  },
  remove(id: string) {
    notifications = notifications.filter(n => n.id !== id)
    listeners.forEach(fn => fn(notifications))
  },
  subscribe(fn: (notifications: Notification[]) => void) {
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  },
  getAll() {
    return notifications
  },
}

export const notify = {
  success: (msg: string) => notificationStore.add('success', msg),
  info: (msg: string) => notificationStore.add('info', msg),
  warning: (msg: string) => notificationStore.add('warning', msg),
}

export type { Notification, NotificationType }
