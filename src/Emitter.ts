import { Subscriptable } from "./types"

type EventArgs<T> = [T] extends [never] ? [] : [T] extends [void] ? [] : [T]

export class Emitter<EventMap extends Record<EventName, unknown>, EventName extends keyof EventMap = keyof EventMap> {
  private callbacks: Partial<Record<keyof never, Set<(...args: any[]) => void>>> = {}
  private callbacksAny = new Set<(value: this) => void>()

  private on<Event extends keyof EventMap>(event: Event, callback: (value: EventMap[Event]) => void) {
    this.callbacks[event] ??= new Set
    this.callbacks[event]?.add(callback)
  }
  private off<Event extends keyof EventMap>(event: Event, callback: (value: EventMap[Event]) => void) {
    this.callbacks[event]?.delete(callback)
  }

  public once<Event extends keyof EventMap>(event: Event, callback: (value: EventMap[Event]) => void): void {
    const once: typeof callback = value => {
      callback(value)
      this.off(event, once)
    }

    this.on(event, once)
  }
  public until<Event extends keyof EventMap>(event: Event, timeout = 15 * 1000): Promise<EventMap[Event]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(`Time's out awaiting event "${event.toString()}"`)), timeout)

      this.once(event, value => {
        resolve(value)
        clearTimeout(timeoutId)
      })
    })
  }

  public dispatch<Event extends keyof EventMap>(event: Event, ...payload: EventArgs<EventMap[Event]>) {
    this.callbacks[event]?.forEach(callback => callback(...payload))
    this.callbacksAny.forEach(callback => callback(this))
  }
  public when<Event extends keyof EventMap>(event: Event): Subscriptable<EventMap[Event]> {
    return {
      subscribe: (next?: (value: EventMap[Event]) => void) => {
        const callback = (value: EventMap[Event]) => next?.(value)
        this.on(event, callback)

        return { unsubscribe: () => this.off(event, callback) }
      }
    }
  }

  public subscribe(next: (value: this) => void) {
    this.callbacksAny.add(next)
    return { unsubscribe: () => void this.callbacksAny.delete(next) }
  }

  protected toJSON() { }
}