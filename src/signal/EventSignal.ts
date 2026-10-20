import { Messager } from "@/Messages"
import { Subscriptable } from "@/types"
import { RefReadonly } from "@/ValueReference"

export class EventSignal<T> implements RefReadonly<T>, Subscriptable<T> {
  protected messager = new Messager<T>
  protected value: T

  get current() { return this.value }

  constructor(initialValue: T) { this.value = initialValue }

  get(): T { return this.value }
  set(newValue: T | ((current: T) => T)): void {
    const value = newValue instanceof Function ? newValue(this.value) : newValue

    this.value = value
    this.messager.dispatch(value)
  }

  subscribe(next: (value: T) => void) { return this.messager.subscribe(next) }

  protected toJSON() { return this.value }
  protected valueOf() { return this.value }
}