import { Signal } from "@/signal/Signal"

import { State } from "./State"
import { StateReconciler, createReconciledDerivation } from "./StateReconciler"

import { ReactiveSource } from "../Flow"


export class StateArray<T> extends Signal<T[]> implements Iterable<T> {
  constructor(init: ReactiveSource<T[]> = []) {
    super(Signal.get(init))
    Signal.subscribe(init, value => this.set(value))
  }

  /**
   * Creates a derived `State` by transforming the whole array,
   * same as `State.to`. The fork detaches from this array when its
   * last observer leaves.
   */
  to<U>(predicate: (value: T[]) => U): State<U> {
    const fork = new State(predicate(this.value))
    const source = this.subscribe(value => {
      const newValue = predicate(value)
      if (newValue === fork.get()) return

      fork.set(newValue)
    })
    fork.setOnEmpty(() => source.unsubscribe())
    return fork
  }

  #reconciler?: StateReconciler<T>

  /**
   * Reconciling strategy augmenting this array's per-item derivations.
   *
   * Assign a `StateReconciler` — usually `StateReconciler.IDENTITY` or one with a
   * custom `equals` — and `map` keeps the derived values of items that are "the
   * same" across updates instead of re-deriving every item. Pairs with Tama's
   * list reconciliation, where surviving mapped views keep their DOM.
   *
   * Assigning stores the strategy only — derivation happens in `map`, and the
   * strategy propagates to mapped children so chained derivations stay reconciled.
   *
   * @example
   * ```ts
   * const rows = new StateArray<Row>([])
   * rows.reconciler = StateReconciler.IDENTITY
   * const views = rows.map(row => <RowView row={row} />)
   * ```
   */
  get reconciler(): StateReconciler<T> | undefined { return this.#reconciler }
  set reconciler(reconciler: StateReconciler<T>) {
    this.#reconciler = reconciler
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
    // With a reconciler installed, surviving items keep their mapped values —
    // the predicate runs at most once per "same" item, so it must be pure
    // with respect to the reconciler's equality.
    const reconciler = this.#reconciler
    if (reconciler != null) {
      const derive = createReconciledDerivation(reconciler, predicate)
      const mapped = new StateArray(derive(this.value))
      mapped.reconciler = reconciler as unknown as StateReconciler<U>
      this.subscribe(value => mapped.set(derive(value)))
      return mapped
    }

    const mapped = new StateArray(this.value.map(predicate))
    this.subscribe(value => mapped.set(value.map(predicate)))
    return mapped
  }

  splice(index: number, deleteCount = 1) {
    const result = this.value.splice(index, deleteCount)
    this.messager.dispatch(this.value)
    return result
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