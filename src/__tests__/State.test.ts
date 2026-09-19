
// tests/State.test.ts
import { describe, expect, it } from "bun:test"

import { State } from "../state/State"

describe("State", () => {
  it("should initialize with a value", () => {
    const state = new State(42)
    expect(state.get()).toBe(42)
  })

  it("should update value via set()", () => {
    const state = new State("a")
    state.set("b")
    expect(state.get()).toBe("b")
  })

  it("should notify subscribers on set()", () => {
    const state = new State(0)
    let called = 0
    state.subscribe(() => called++)
    state.set(1)
    state.set(2)
    state.set(3)
    expect(called).toBe(3)
  })

  it("should anyway notify if value is unchanged", () => {
    const s = new State("x")
    let called = 0
    s.subscribe(() => called++)
    s.set("x")
    expect(called).toBe(1)
  })

  it("should not notify child from `to` method if parent state is changed", () => {
    const parent = new State("x")
    const child = parent.to(x => x)

    let called = 0
    child.subscribe(() => called++)
    parent.set("x")
    expect(called).toBe(0)
  })

  it("should support derived state via capture()", () => {
    const a = new State(2)
    const b = new State(3)
    const sum = State.capture(() => a.use() + b.use())

    expect(sum.get()).toBe(5)
    a.set(4)
    expect(sum.get()).toBe(7)
  })

  it("should support subscription to derived state", () => {
    const a = new State(1)
    const b = new State(2)
    const sum = State.capture(() => a.use() + b.use())
    let result = 0
    sum.subscribe(x => result = x)
    a.set(3)
    expect(result).toBe(5)
  })

  it("should unsubscribe correctly", () => {
    const state = new State(10)
    let count = 0
    const sub = state.subscribe(() => count++)
    state.set(20)
    sub.unsubscribe()
    state.set(30)
    expect(count).toBe(1)
  })

  it("should allow multiple subscribers", () => {
    const state = new State(0)

    let a = 0
    let b = 0

    state.subscribe(x => a = x)
    state.subscribe(x => b = x * 2)

    state.set(5)

    expect(a).toBe(5)
    expect(b).toBe(10)
  })

  it("should create State from state-, observable-like, plain values", () => {
    // Plain.
    expect(State.from(0)).toEqual(new State(0))
    expect(State.from([])).toEqual(new State([]))
    expect(State.from({})).toEqual(new State({}))
    // State.
    expect(State.from(new State({}))).toEqual(new State({}))
    // State-like
    expect(State.from({ get: () => ({}) })).toEqual(new State({}))
    // Observable-like
    const _testState = new State<object | undefined>(undefined)
    const observableLike = { subscribe: _testState.subscribe.bind(_testState) }

    const subscribeState = State.from(observableLike)
    expect(subscribeState).toEqual(new State<object | undefined>(undefined))
    _testState.set({ foo: "bar" })
    expect(subscribeState).toEqual(new State<object | undefined>({ foo: "bar" }))
  })

  it("should capture next value with `Promise`", async () => {
    const state = new State(0)
    expect(state.current).toBe(0)

    setTimeout(() => state.set(1))

    const upcoming = await state.upcoming
    expect(upcoming).toBe(1)
  })

  it("should set from transformed source (sets)", async () => {
    const pointerX = new State(0)
    const event = new State({ x: 0 })

    event.sets(pointerX.from(event => event.x))
    event.set({ x: 1 })
    expect(pointerX.current).toBe(1)
  })
  it("should set from transformed source (subscribe)", async () => {
    const pointerX = new State(0)
    const event = new State({ x: 0 })

    event.subscribe(pointerX.from(event => event.x))
    event.set({ x: 1 })
    expect(pointerX.current).toBe(1)
  })
})

describe("State.to detachment", () => {
	it("detaches a fork from its source when its last subscriber leaves", () => {
		const source = new State(1)
		const fork = source.to(value => value * 2)

		const first = fork.subscribe(() => { })
		expect(fork.get()).toBe(2)

		source.set(3)
		expect(fork.get()).toBe(6)

		first.unsubscribe()
		source.set(10)
		expect(fork.get()).toBe(6) // Detached — no longer follows the source.
	})

	it("keeps a fork subscribed while it has subscribers", () => {
		const source = new State(1)
		const fork = source.to(value => value * 2)

		const keep = fork.subscribe(() => { })
		const drop = fork.subscribe(() => { })
		drop.unsubscribe()

		source.set(5)
		expect(fork.get()).toBe(10)
		keep.unsubscribe()
	})
})
