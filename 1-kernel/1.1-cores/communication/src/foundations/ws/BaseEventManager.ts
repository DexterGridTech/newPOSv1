import type {SocketEvent, SocketEventType} from '../../types'

export type SocketEventListener<TIncoming = unknown> = (event: SocketEvent<TIncoming>) => void

export class BaseEventManager<TIncoming = unknown> {
  private readonly listeners = new Map<SocketEventType, Set<SocketEventListener<TIncoming>>>()

  on(eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void {
    const set = this.listeners.get(eventType) ?? new Set<SocketEventListener<TIncoming>>()
    set.add(listener)
    this.listeners.set(eventType, set)
  }

  off(eventType: SocketEventType, listener: SocketEventListener<TIncoming>): void {
    this.listeners.get(eventType)?.delete(listener)
  }

  emit(event: SocketEvent<TIncoming>): void {
    this.listeners.get(event.type)?.forEach(listener => listener(event))
  }

  clear(): void {
    this.listeners.clear()
  }
}
