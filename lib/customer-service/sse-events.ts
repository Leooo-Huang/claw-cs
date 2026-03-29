import type { CustomerServiceSSEEvent } from './types'

type Listener = (event: CustomerServiceSSEEvent) => void
const listeners = new Set<Listener>()

export const csEmitter = {
  subscribe(fn: Listener) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
  emit(event: CustomerServiceSSEEvent) {
    listeners.forEach(fn => fn(event))
  },
}
