import { describe, expect, it } from "bun:test"

import { Emitter } from "../Emitter"


interface Events {
  add: number
  clear: void
}

describe("Emitter", () => {
  it("should pass the dispatched value to when subscribers", () => {
    const emitter = new Emitter<Events>()
    const seen: number[] = []

    emitter.when("add").subscribe(value => seen.push(value))
    emitter.dispatch("add", 1)
    emitter.dispatch("add", 2)

    expect(seen).toEqual([1, 2])
  })

  it("should call void events without arguments", () => {
    const emitter = new Emitter<Events>()
    let args: unknown[] | undefined

    emitter.when("clear").subscribe((...value) => args = value)
    emitter.dispatch("clear")

    expect(args).toEqual([])
  })

  it("should stop notifying after unsubscribe", () => {
    const emitter = new Emitter<Events>()
    let called = 0

    const subscription = emitter.when("add").subscribe(() => called++)
    emitter.dispatch("add", 1)
    subscription.unsubscribe()
    emitter.dispatch("add", 2)

    expect(called).toBe(1)
  })

  it("should notify once for once listeners", () => {
    const emitter = new Emitter<Events>()
    let called = 0

    emitter.once("add", () => called++)
    emitter.dispatch("add", 1)
    emitter.dispatch("add", 2)

    expect(called).toBe(1)
  })

  it("should notify all-event subscribers on every dispatch", () => {
    const emitter = new Emitter<Events>()
    let called = 0

    emitter.subscribe(() => called++)
    emitter.dispatch("add", 1)
    emitter.dispatch("clear")

    expect(called).toBe(2)
  })
})
