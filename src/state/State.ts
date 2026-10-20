import { Primitive } from "type-fest"

import { ExtractGetable, ObservableGetter } from "@/Flow"
import createReactiveSelector, { ReactiveSelector } from "@/ReactiveAccessor"
import { ClosureCaptor } from "@/signal/ClosureSignal"
import { Signal } from "@/signal/Signal"
import { AccessorGet, AccessorSet, AccessorSetAction, Observable, ObservableOptions, Subscriptable, Unsubscribe } from "@/types"
import { isObservableGetter, isObservableLike } from "@/utils"
import { Ref } from "@/ValueReference"

import { StateOrPlain } from "./State.types"


export class State<T> extends Signal<T> {
  /** Subscribes to updates and immediately calls the `callback`. */
  subscribeImmediate(callback: (value: T) => void, options?: ObservableOptions) {
    if (!options?.signal?.aborted) callback(this.value)
    return this.subscribe(callback, options)
  }

  /**
   * Sets value of this state to `other` one continuously.
   * 
   * @example
   * ```ts
   * const state1 = new State(123)
   * const state2 = new State(0)
   * state1.sets(state2)
   * state2 // Becomes `123`.
   * ```
   * 
   * @example
   * Can be combined with `from` method
   * ```ts
   * const state1 = new State("123")
   * const state2 = new State(0)
   * state1.sets(state2.from(parseInt))
   * ```
   */
  sets<U>(other: AccessorSetAction<U | T>): Unsubscribe {
    return this.messager.subscribe(value => other.set(value))
  }
  /** Copies value from `other` Signal-like structure just once. */
  copy(other: Ref<T> | AccessorGet<T>) {
    if ("current" in other) {
      this.set(other.current)
      return
    }

    this.set(other.get())
  }


  private declare _$?: ReactiveSelector<T>
  /**
   * @example
   * ```ts
   * const app = new State({ user: { name: "test" } })
   * // Observable Access
   * app.$.user.$.name instanceof State // true
   * // Usage of `$` is cached and only created once.
   * app.$.user === app.$.user // true
   * // Setting to accessed property actually changes it.
   * app.$.user.$.name.set("me")
   * app.get().user.name === "me" // true
   * ```
   */
  get $() {
    if (this._$ == null) {
      this._$ = createReactiveSelector(this)
    }
    return this._$
  }

  /**
   * `to` is an alternative name of `map` function because `state.map(x => x.map(e => e))` looks weird.
   * But looks neat as Tacit programming - `string.to(Number)`
   * 
   * Creates a new instance, transforms the value and assigns it.
   * 
   * 
   * @example
   * Useful when to select a value with reactivity:
   * ```ts
   * const ypx = new State("15px")
   * const y = ypx.to(parseFloat)
   * 
   * ypx.set("16px") // Will set `y` to `16`.
   * y.set(15) // Will not affect `ypx`.
   *   ```
   */
  to<U>(predicate: (value: T) => U): State<U> {
    const fork = new State(predicate(this.value))
    const source = this.subscribe(value => {
      const newValue = predicate(value)
      if (newValue === fork.get()) return

      fork.set(newValue)
    })
    // The fork detaches from this state when its last observer leaves, so forks
    // owned by removed views stop tracking their source instead of leaking.
    fork.setOnEmpty(() => source.unsubscribe())
    return fork
  }

  /**
   * Useful when you want to fit a "source" ("sink") to the state.
   * By providing `predicate` function, the source value can transformed and set automatically.
   * 
   * @example
   * ```ts
   * const pointerX = new State(0)
   * 
   * window.addEventListener("pointermove", pointerX.from(event => event.x)) // Or
   * window.when("pointermove").subscribe(pointerX.from(event => event.x))
   * 
   * const event = new State(new PointerEvent(""))
   * 
   * event.sets(pointerX.from(event => event.x)) // Or
   * event.subscribe(pointerX.from(event => event.x))
   * ```
   * 
   * This literally says "`event` sets `value` from `event.currentTarget.value`".
  */
  from<U>(predicate: (value: U extends (v: infer R) => any ? R : U) => T): StateSourcing<U> {
    const sourcing = (value: U) => this.set(predicate(value as never))
    sourcing.set = sourcing
    sourcing.next = sourcing
    return sourcing
  }

  /**
   * A semantics helper and characters saver. Always produces `boolean`.
   * 
   * @example
   * const state1 = new State("asd")
   * const state2 = new State("asd")
   * 
   * const same1 = state1.is("asd") // Depends on 1 state.
   * const same2 = state1.is(state2) // Depends on 2 states.
   * 
   * @returns a hook to be used by another program. Is not intended to be transformed after.
   */
  is<O extends Primitive>(other: T | O): AccessorGet<boolean> & Subscriptable<boolean>
  is(other: ObservableGetter<unknown>): AccessorGet<boolean> & Subscriptable<boolean>
  is(predicate: (value: T) => boolean): AccessorGet<boolean> & Subscriptable<boolean>
  is<U extends T>(arg1: ((value: T) => value is U) | ObservableGetter<unknown> | U): AccessorGet<boolean> & Subscriptable<boolean> {
    if (arg1 instanceof Function) {
      return { get: () => arg1(this.value), subscribe: next => this.messager.subscribe(value => next(arg1(value))) }
    }

    return State.combine([this, arg1], (value, arg1) => value === arg1).readonly
  }

  get readonly(): AccessorGet<T> & Subscriptable<T> {
    return { get: this.get.bind(this), subscribe: this.subscribe.bind(this) }
  }
  get writeonly(): AccessorSet<T> {
    return { set: this.set.bind(this) }
  }

  /** Captures next state value. */
  get upcoming(): Promise<T> {
    let subscription: Unsubscribe

    const promise = new Promise<T>(resolve => {
      subscription = this.subscribe(value => {
        resolve(value)
        subscription.unsubscribe()
      })
    })

    return promise
  }
}

export namespace State {
  export function subscribeImmediate(value: unknown, callback: (value: unknown) => void, options?: ObservableOptions) {
    const result = State.subscribe(value, callback, options)

    if (options?.signal?.aborted) return result

    const unwrappedValue = State.get(value)
    if (unwrappedValue === value && unwrappedValue instanceof Object && isObservableLike(unwrappedValue)) {
      return result
    }

    callback(unwrappedValue)
    return result
  }

  /**
   * Captures usage of `use`.
   * 
   * @example
   * ```ts
   * const state4 = State.capture(() => state1.use() + state2.use() + state3.get())
   * ```
   * `state4` only updates from `state1` and `state2`.
   */
  export function capture<T>(closure: () => T): State<T> {
    const signal = new State<T>(null as never) // Assume it will be actually initiated before first get.
    const signalClosure = () => signal.set(closure())

    new ClosureCaptor(signalClosure).capture()
    return signal
  }

  /** Takes Signal-like values, transforms (by `predicate`) and reduces them to the one. */
  export function combine<const States extends unknown[], U>(states: States, predicate: (...values: {
    [K in keyof States]: ExtractGetable<States[K]>
  }) => U): State<U> {
    const values = states.map(State.get)

    const computed = new State(predicate(...values as never))

    states.forEach((state, index) => {
      State.subscribe(state, value => {
        values[index] = value
        computed.set(predicate(...values as never))
      })
    })

    return computed
  }

  /**
   * Collects many Signal-like values from a plain array.
   * @returns `State` of array with plain values that updates every time **any** "Signal" changes.
   */
  export function collect<const T extends unknown[]>(array: T): State<{ [K in keyof T]: ExtractGetable<T[K]> }>
  /**
   * Collects many Signal-like values from a plain record (object).
   * @returns `State` of object with plain key-values that updates every time **any** "Signal" changes.
   */
  export function collect<T extends Record<keyof never, unknown>>(record: T): State<{ [K in keyof T]: ExtractGetable<T[K]> }>
  export function collect(arg1: any): unknown {
    if (arg1 instanceof Array) {
      return State.combine(arg1, (...values) => values)
    }

    const result = {} as any
    const record = new State(result)

    for (const key in arg1) {
      const value = arg1[key]
      if (isObservableGetter(value) === false) {
        result[key] = value
        continue
      }

      result[key] = value.get()
      State.subscribe(value, it => {
        result[key] = it
        record.set(result)
      })
    }

    return record
  }

  /**
   * Formats a string from Signal-like values into one.
   * 
   * @example
   * const state = State.f`My name is ${name}`
   */
  export function f(strings: TemplateStringsArray, ...values: unknown[]): State<string> {
    return State.combine(values, (...values) => strings.map((string, i) => string + String(values[i] ?? "")).join(""))
  }
  /** Forks state. */
  export function from<T>(item: State<T>): State<T>
  /** Copies initial value once. */
  export function from<T>(item: AccessorGet<T>): State<T>
  /** Copies initial value once and subscribes to updates. */
  export function from<T>(item: ObservableGetter<T>): State<T>
  /** No initial value, but subscribes to future updates. */
  export function from<T>(item: Observable<T> | Subscriptable<T>): State<T | undefined>
  export function from<T>(item: StateOrPlain<T>): State<T>
  /** Copies initial value. */
  export function from<T>(item: T): State<T>
  export function from<T>(item: StateOrPlain<T>): State<T> {
    if (item instanceof State) return new State(item.get())
    if (isObservableGetter(item)) {
      const state = new State<any>(item.get())

      if ("subscribe" in item) item.subscribe(value => state.set(value))
      else if (Symbol.subscribe in item) item[Symbol.subscribe](value => state.set(value))

      return state
    }
    if (isObservableLike(item)) {
      const state = new State<T | undefined>(undefined)
      State.subscribe(item, value => state.set(value as never))
      return state as never
    }

    return new State(State.get(item as T))
  }

  export async function* asyncIterableOf<T>(state: State<Promise<T>>): AsyncGenerator<T> {
    yield await state.get()
    // Temporal solution, it should be improved when `Proton` and `State` have lifecycle APIs.
    while (true) yield await state.upcoming
  }
}

/** @internal */
interface StateSourcing<T> {
  (value: T): void
  set(value: T): void
  next(value: T): void
}
