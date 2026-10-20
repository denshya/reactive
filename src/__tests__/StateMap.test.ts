import { describe, expect, it } from "bun:test"

import { State } from "../state/State"
import { StateMap } from "../state/StateMap"


describe("StateMap", () => {
  it("should initialize from entries", () => {
    const map = new StateMap([["a", 1], ["b", 2]])

    expect(map.get("a")).toBe(1)
    expect(map.size).toBe(2)
  })

  it("should notify subscribers on set", () => {
    const map = new StateMap<string, number>()
    let called = 0

    map.subscribe(() => called++)
    map.set("a", 1)

    expect(called).toBe(1)
  })

  it("should assign multiple entries at once", () => {
    const map = new StateMap<string, number>()
    let called = 0

    map.subscribe(() => called++)
    map.set(new Map([["a", 1], ["b", 2]]))
    map.set({ c: 3 })

    expect(called).toBe(2)
    expect(Object.fromEntries(map)).toEqual({ a: 1, b: 2, c: 3 })
  })

  it("should set an undefined value", () => {
    const map = new StateMap<string, number | undefined>()

    map.set("a", undefined)

    expect(map.has("a")).toBe(true)
  })

  it("should notify only when delete removes an entry", () => {
    const map = new StateMap([["a", 1]])
    let called = 0

    map.subscribe(() => called++)
    expect(map.delete("missing")).toBe(false)
    expect(map.delete("a")).toBe(true)

    expect(called).toBe(1)
  })

  it("should notify only when clear removes entries", () => {
    const map = new StateMap<string, number>()
    let called = 0

    map.subscribe(() => called++)
    map.clear()
    map.set("a", 1)
    map.clear()

    expect(called).toBe(2)
    expect(map.size).toBe(0)
  })

  it("should call the listener immediately with subscribeImmediate", () => {
    const map = new StateMap([["a", 1]])
    let seen: Map<string, number> | undefined

    map.subscribeImmediate(value => seen = value)

    expect(seen).toBe(map)
  })

  it("should follow key and map changes in get$", () => {
    const map = new StateMap([[1, "one"], [2, "two"]])
    const key = new State<number | null>(1)
    const selected = map.get$(key)

    expect(selected.get()).toBe("one")

    map.set(1, "uno")
    expect(selected.get()).toBe("uno")

    key.set(2)
    expect(selected.get()).toBe("two")

    key.set(null)
    expect(selected.get()).toBeUndefined()
  })

  it("should serialize as a record", () => {
    const map = new StateMap([["a", 1], ["b", 2]])

    expect(JSON.stringify(map)).toBe("{\"a\":1,\"b\":2}")
  })

  it("should create from a record", () => {
    const map = StateMap.fromJSON({ a: 1, b: 2 })

    expect(map.get("a")).toBe(1)
    expect(map.size).toBe(2)
  })

  it("should follow a reactive source in fromIterable", () => {
    const users = new State([{ id: 1, name: "FrameMuse" }])
    const map = StateMap.fromIterable(users)
    let called = 0

    map.subscribe(() => called++)
    expect(map.get(1)?.name).toBe("FrameMuse")

    users.set([{ id: 1, name: "Denshya" }, { id: 2, name: "Reactive" }])

    expect(called).toBe(2)
    expect(map.get(1)?.name).toBe("Denshya")
    expect(map.get(2)?.name).toBe("Reactive")
  })
})
