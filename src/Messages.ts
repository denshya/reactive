import { Batcher } from "./Batch"
import { ObservableOptions, Unsubscribe } from "./types"

export class Messager<T> {
  private readonly callbacks = new Set<(value: T) => void>()

  private pending = false
  private declare pendingValue: T

  /**
   * Runs when the last subscriber leaves. Derived states (like `State.to` forks)
   * use it to detach from their source instead of staying subscribed forever.
   * @internal
   */
  onEmpty?: () => void

  dispatch(value: T): void {
    if (Batcher.isBatching() === false) {
      this.callbacks.forEach(callback => callback(value))
      return
    }

    this.pendingValue = value
    if (this.pending) return

    this.pending = true
    Batcher.enqueue(this, () => {
      this.pending = false
      this.callbacks.forEach(callback => callback(this.pendingValue))
    })
  }

  subscribe(next: (value: T) => void, options?: ObservableOptions): Unsubscribe {
    // An already aborted signal can never fire, so such a subscription would never
    // be released by it. Subscribe to nothing instead of leaking the callback.
    if (options?.signal?.aborted) {
      return { unsubscribe: () => { } }
    }

    this.callbacks.add(next)

    // No FinalizationRegistry here: it would only fire once this messager is already
    // garbage, while taxing every subscription with a registration and every mass
    // disposal with a GC-time callback storm. Subscriptions die with their source.
    let unsubscribe = () => {
      this.callbacks.delete(next)
      unsubscribe = () => { }
      if (this.callbacks.size === 0) this.onEmpty?.()
    }
    options?.signal?.addEventListener("abort", unsubscribe)

    return { unsubscribe }
  }

  protected toJSON(): void { }
}

/**
 * Shorthand for `Messager<void>`. You can use it for better semantics.
 */
export class Notifier extends Messager<void> { }