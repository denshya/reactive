import { describe, expect, it } from "bun:test"

import { StateArray } from "@/state/StateArray"

import { State } from "../state/State"


describe("StateArray", () => {
  it("should return fromAsync", async () => {
    const { resolve, promise } = Promise.withResolvers<number[]>()

    const stateArray = StateArray.fromAsync(new State(promise))
    expect(stateArray.get()).toEqual([])

    resolve([1, 2, 3])
    await promise
    expect(stateArray.get()).toEqual([1, 2, 3])
  })

  it("should return fromAsync 2", async () => {
    const state = new State([1, 2, 3]).to(async x => x)
    const stateArray = StateArray.fromAsync(state)
    expect(stateArray.get()).toEqual([])

    await state.current
    expect(stateArray.get()).toEqual([1, 2, 3])
  })
})

describe("StateArray.to detachment", () => {
  it("detaches a fork from its array when its last subscriber leaves", () => {
    const source = new StateArray([1, 2, 3])
    const fork = source.to(values => values.length)

    const subscription = fork.subscribe(() => { })
    expect(fork.get()).toBe(3)

    source.push(4)
    expect(fork.get()).toBe(4)

    subscription.unsubscribe()
    source.push(5)
    expect(fork.get()).toBe(4)
  })
})
