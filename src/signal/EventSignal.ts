import { Messager } from "@/Messages"
import { Subscriptable, Unsubscribe } from "@/types"
import { RefReadonly } from "@/ValueReference"

export class EventSignal<T> implements RefReadonly<T>, Subscriptable<T> {
  protected messager: Messager<T> = new Messager<T>
  protected value: T

  get current(): T { return this.value }

  constructor(initialValue: T) { this.value = initialValue }

  get(): T { return this.value }
  set(newValue: T | ((current: T) => T)): void {
    const value = newValue instanceof Function ? newValue(this.value) : newValue

    this.value = value
    this.messager.dispatch(value)
  }

  subscribe(next: (value: T) => void): Unsubscribe { return this.messager.subscribe(next) }

  protected toJSON(): T { return this.value }
  protected valueOf(): T { return this.value }
}