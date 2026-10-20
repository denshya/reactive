import { Emitter } from "@/Emitter"
import { EventSignal } from "@/signal/EventSignal"
import { Subscriptable } from "@/types"

export class StateFSM<T extends keyof never> extends EventSignal<T> {
  private readonly events = new Emitter<Record<T, void>>()
  when(state: T): Subscriptable<void> { return this.events.when(state) }

  override set(newValue: T | ((current: T) => T)): void {
    super.set(newValue)
    this.events.dispatch(this.value)
  }
}
