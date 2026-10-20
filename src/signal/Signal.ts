import { RefReadonly } from "@/ValueReference"

import { ClosureParticipant } from "./ClosureSignal"

import { Batcher, type BatchScheduler } from "../Batch"
import { ObservableGetter, ReactiveSource } from "../Flow"
import { Messager } from "../Messages"
import { Observable, ObservableOptions, Subscriptable, Unsubscribe } from "../types"
import { isObservableGetter, isObservableLike } from "../utils"


/** Normalizes the unsubscribe shapes used by third-party observables. */
function asUnsubscribe(subscription: unknown): Unsubscribe {
  if (subscription instanceof Function) return { unsubscribe: subscription as () => void }
  if (subscription instanceof Object && "unsubscribe" in subscription) return subscription as Unsubscribe

  return { unsubscribe: () => { } }
}


export class Signal<T> implements RefReadonly<T>, Observable<T>, Subscriptable<T> {
  protected closureParticipant: ClosureParticipant = new ClosureParticipant
  protected messager: Messager<T> = new Messager<T>
  protected value: T

  /** Retrieves current `value` without side-effects. Alias to `get`. */
  get current(): T { return this.value }

  constructor(initialValue: T) { this.value = initialValue }

  /** 
   * Besides returning `value`, sends itself to the capturing closure signal
   * to act as if `Signal` is directly subscribed.
   * 
   * @example
   * const state1 = new Signal(123)
   * const state2 = new Signal(456)
   * const state3 = Signal.capture(() => state1.use() + state2.use())
   * */
  use(): T {
    this.closureParticipant.attach()
    return this.value
  }

  /** Retrieves current `value` without side-effects. */
  get(): T { return this.value }
  /** Sets given `newValue` or transforms current version of `value`, propagates updates to subscribers. */
  set<U extends T>(newValue: U | ((current: T) => T)): void {
    const value = newValue instanceof Function ? newValue(this.value) : newValue

    this.value = value
    this.messager.dispatch(value)
    this.closureParticipant.dispatch()
  }

  /** Invokes `callback` when `observable` updates. */
  subscribe(callback: (value: T) => void, options?: ObservableOptions): Unsubscribe { return this.messager.subscribe(callback, options) }
  [Symbol.subscribe](next: (value: T) => void, options?: ObservableOptions): Unsubscribe { return this.messager.subscribe(next, options) }

  // Registers a callback that runs when the last observer unsubscribes.
  // Derived signals use it to detach from their source.
  /** @internal */
  setOnEmpty(callback: () => void): void { this.messager.onEmpty = callback }

  protected toJSON(): T { return this.value }
  protected valueOf(): T { return this.value }
}


export namespace Signal {
  /** Invokes `callback` when `observable` updates. */
  export function subscribe<T>(observable: ReactiveSource<T> | Observable<T> | Subscriptable<T>, callback: (value: T) => void, options?: ObservableOptions): Unsubscribe
  export function subscribe(value: unknown, callback: (value: any) => void, options?: ObservableOptions): Unsubscribe {
    if (value == null || value instanceof Object === false || isObservableLike(value) === false) {
      return { unsubscribe: () => { } }
    }

    // An already aborted signal would never release the subscription.
    if (options?.signal?.aborted) return { unsubscribe: () => { } }

    const subscription = "subscribe" in value
      ? value.subscribe(callback)
      : value[Symbol.subscribe](callback)
    const unsubscribe = asUnsubscribe(subscription)

    options?.signal?.addEventListener("abort", unsubscribe.unsubscribe)
    return unsubscribe
  }

  /**
   * Merges notifications via `subscribe` into one.
   *
   * @example
   * // Logs only once => "Hello Jane Roe"
   * State.combine([first, last], (first, last) => console.log("Hello " + first + " " + last))
   * 
   * ```ts
   * State.batch(() => {
   *   first.set("Jane")
   *   last.set("Roe")
   * })
   *
   * await State.batch(() => {
   *   first.set("Janet")
   * }, queueMicrotask)
   * ```
   */
  export function batch<T>(closure: () => T): T
  export function batch<T>(closure: () => T, scheduler: BatchScheduler): Promise<T>
  export function batch<T>(closure: () => T, scheduler?: BatchScheduler): T | Promise<T> {
    return scheduler == null ? Batcher.batch(closure) : Batcher.batch(closure, scheduler)
  }

  /**
 * Allows using plain observables within capturing closure.
 * 
 * @example
 * 
 * const observable1 = new Observable
 * const signal2 = new Signal
 * 
 * Signal.capture(() => signal2.use() + Signal.use(observable1))
 */
  export function use<T>(value: T | Signal<T> | ObservableGetter<T>): T {
    if (value instanceof Signal) return value.use()
    if (isObservableGetter(value)) {
      const anonymousParticipant = new ClosureParticipant
      anonymousParticipant.attach()

      if ("subscribe" in value) value.subscribe(() => anonymousParticipant.dispatch())
      else if (Symbol.subscribe in value) value[Symbol.subscribe](() => anonymousParticipant.dispatch())

      return value.get()
    }

    return value
  }

  /** Unwraps reactivity source. @returns current value of `value`. */
  export function get<T>(value: ReactiveSource<T>): T {
    if (value instanceof Function) return value()
    if (value instanceof Object) {
      if ("get" in value) return value.get()
      if ("current" in value) return value.current
    }

    return value
  }

  /** 
   * Disables *propagation* until the lock is disposed.
   * 
   * @example
   * state1.sets(state2)
   * state1.subscribe(value => {
   *   if (value === 1) {
   *     using lock = Signal.lock(state2) // or Signal.lock([state2])
   *   }
   * 
   *   state3.set(value)
   * })
   * 
   * state2.subscribe(console.log)
   * state3.subscribe(console.log)
   * 
   * state1.set(2) // Both `state2` and `state3` call `console.log`.
   * state1.set(1) // Only `state3` calls `console.log`.
   */
  // export function lock(signal: Signal<unknown>): Disposable
  // export function lock(signals: Signal<unknown>[]): Disposable
  // export function lock(signals: Signal<unknown> | Signal<unknown>[]): Disposable {
  //   if (signals instanceof Array) {
  //     signals.forEach(signal => signal.messager.locked = true)
  //   } else {
  //     signals.messager.locked = true
  //   }

  //   return {
  //     [Symbol.dispose]: () => {
  //       if (signals instanceof Array) {
  //         signals.forEach(signal => signal.messager.locked = false)
  //       } else {
  //         signals.messager.locked = false
  //       }
  //     }
  //   }
  // }
}
