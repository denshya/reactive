import { describe, expect, it } from "bun:test"

import { Signal } from "../signal/Signal"
import { State } from "../state/State"


describe("Signal.subscribe", () => {
  it("should unsubscribe when the signal aborts", () => {
    const state = new State(0)
    const controller = new AbortController()
    let called = 0

    Signal.subscribe(state, () => called++, { signal: controller.signal })
    state.set(1)
    controller.abort()
    state.set(2)

    expect(called).toBe(1)
  })

  it("should not subscribe to an already aborted signal", () => {
    const state = new State(0)
    let called = 0

    Signal.subscribe(state, () => called++, { signal: AbortSignal.abort() })
    state.set(1)

    expect(called).toBe(0)
  })

  it("should normalize a function returned by a third-party observable", () => {
    let disposed = 0
    const observable = { subscribe: () => () => disposed++ }

    const subscription = Signal.subscribe(observable as never, () => { })
    subscription.unsubscribe()

    expect(disposed).toBe(1)
  })
})
