import { Messager } from "@/Messages"
import { Signal } from "@/signal/Signal"
import { ObservableOptions, Subscriptable, Unsubscribe } from "@/types"

import { ReactiveSource } from "../Flow"
import { State } from "./State"


const idSelector = (item: any) => item.id


/**
 * A `Map` that notifies subscribers after every mutation.
 *
 * Keys can be observed through `get$`, which returns a `State` that follows
 * both the key and the map.
 */
export class StateMap<K, V> extends Map<K, V> implements Subscriptable<Map<K, V>> {
  protected messager: Messager<Map<K, V>> = new Messager<Map<K, V>>

  constructor(init?: Iterable<readonly [K, V]>) {
    super()

    // `Map` constructor calls the overridden `set`, which would dispatch
    // before the messager field exists.
    if (init) for (const [key, value] of init) super.set(key, value)
  }

  subscribe(listener: (value: Map<K, V>) => void, options?: ObservableOptions): Unsubscribe {
    return this.messager.subscribe(listener, options)
  }
  subscribeImmediate(listener: (value: Map<K, V>) => void, options?: ObservableOptions): Unsubscribe {
    if (!options?.signal?.aborted) listener(this)
    return this.subscribe(listener, options)
  }

  override clear(): void {
    if (this.size === 0) return

    super.clear()
    this.messager.dispatch(this)
  }
  override delete(key: K): boolean {
    const deleted = super.delete(key)
    if (deleted) this.messager.dispatch(this)

    return deleted
  }

  override set(key: K, value: V): this
  override set(entries: Iterable<readonly [K, V]>): this
  override set(record: Record<string, V>): this
  override set(arg1: K | Iterable<readonly [K, V]> | Record<string, V>, arg2?: V): this {
    if (arguments.length > 1) {
      super.set(arg1 as K, arg2 as V)
    } else if (arg1 instanceof Map || Symbol.iterator in Object(arg1)) {
      for (const [key, value] of arg1 as Iterable<readonly [K, V]>) super.set(key, value)
    } else {
      const record = arg1 as Record<string, V>
      for (const key in record) super.set(key as K, record[key])
    }

    this.messager.dispatch(this)
    return this
  }

  /** Returns a state of the value at `key` that follows key and map changes. */
  get$(key: ReactiveSource<K | null | undefined>): State<V | undefined> {
    const read = (value: K | null | undefined) => value == null ? undefined : super.get(value)
    let activeKey = Signal.get(key)
    const state = new State(read(activeKey))
    const update = (value: K | null | undefined) => {
      const next = read(value)
      if (next !== state.get()) state.set(next)
    }

    const keySubscription = Signal.subscribe(key, value => {
      activeKey = value
      update(value)
    })
    const mapSubscription = this.subscribe(() => update(activeKey))
    state.setOnEmpty(() => {
      keySubscription.unsubscribe()
      mapSubscription.unsubscribe()
    })

    return state
  }

  toJSON(): Record<string, V> {
    return Object.fromEntries(this)
  }

  static fromJSON<K extends string, V>(record: Record<K, V>): StateMap<K, V> {
    return new StateMap(Object.entries(record) as [K, V][])
  }

  static fromIterable<K, T>(items: ReactiveSource<Iterable<T>>, keySelector: (item: T) => K): StateMap<K, T>
  static fromIterable<T extends { id: unknown }>(items: ReactiveSource<Iterable<T>>): StateMap<T["id"], T>
  static fromIterable<K, T>(items: ReactiveSource<Iterable<T>>, keySelector: (item: T) => K = idSelector): StateMap<K, T> {
    const stateMap = new StateMap<K, T>()
    const update = (values: Iterable<T>) => {
      for (const item of values) stateMap.set(keySelector(item), item)
    }

    update(Signal.get(items))
    Signal.subscribe(items, update)

    return stateMap
  }
}
