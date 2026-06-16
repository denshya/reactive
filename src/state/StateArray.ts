import { Signal } from "@/signal/Signal"

import { State } from "./State"

import { ReactiveSource } from "../Flow"


export class StateArray<T> extends Signal<T[]> implements Iterable<T> {
  constructor(init: ReactiveSource<T[]> = []) {
    super(Signal.get(init))
    Signal.subscribe(init, value => this.set(value))
  }

  /**
   * - Default mode - `array.at(...)`
   * - Direct mode - `array[...]`
   */
  at(index: ReactiveSource<number>): State<T | undefined>
  at(index: ReactiveSource<number>, mode: "direct"): State<T>
  at(index: ReactiveSource<number>, mode?: "direct") {
    if (mode === "direct") {
      return State.combine([this, index], (array, index) => array[index])
    }

    return State.combine([this, index], (array, index) => array.at(index))
  }

  /** Adds value to the end of the array and notifies subscribers. */
  push(value: T): number {
    const index = this.value.push(value)
    this.messager.dispatch(this.value)

    return index
  }

  /** Behaves the same way that `Array` does. Transforms every value with `predicate` and create new instance of `StateArray`. */
  map<U>(predicate: (value: T, index: number, array: T[]) => U): StateArray<U> {
    const mapped = new StateArray(this.value.map(predicate))
    this.subscribe(value => mapped.set(value.map(predicate)))
    return mapped
  }

  splice(index: number, deleteCount = 1) {
    const result = this.value.splice(index, deleteCount)
    this.messager.dispatch(this.value)
    return result
  }

  /**
   * Creates a derived State that transforms the array value.
   * Similar to State.to() but for StateArray.
   *
   * @example
   * const items = new StateArray([1, 2, 3])
   * const count = items.to(arr => arr.length)  // State<number>
   * const doubled = items.to(arr => arr.map(x => x * 2))  // State<number[]>
   */
  to<U>(predicate: (value: T[]) => U): State<U> {
    const fork = new State(predicate(this.value))
    this.subscribe(value => {
      const newValue = predicate(value)
      if (newValue === fork.value) return
      fork.set(newValue)
    })
    return fork
  }

  *[Symbol.iterator]() { yield* this.value }
}

export namespace StateArray {
  export function from<T>(init: ReactiveSource<T[] | null | undefined>) {
    const state = new StateArray(Signal.get(init) ?? [])
    Signal.subscribe(init, value => state.set(value ?? []))
    return state
  }
  export function fromAsync<T>(init: ReactiveSource<Promise<T[]>>): StateArray<T> {
    const state = new StateArray<T>()

    State.subscribeImmediate(init, value => {
      Promise.resolve(value).then(x => state.set((x as any) ?? []))
    })

    return state
  }
}