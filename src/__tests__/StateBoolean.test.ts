import { describe, expect, it } from "bun:test"

import { StateBoolean } from "../state/StateBoolean"


describe("StateBoolean", () => {
  it("should toggle its value", () => {
    const state = new StateBoolean(false)

    state.toggle()

    expect(state.get()).toBe(true)
  })

  it("should follow the source with negated", () => {
    const state = new StateBoolean(false)
    const negated = state.negated

    expect(negated.get()).toBe(true)

    state.toggle()
    expect(negated.get()).toBe(false)
  })
})
