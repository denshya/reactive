import { describe, expect, it } from "bun:test"

import { StateArray } from "../state/StateArray"
import { StateMap } from "../state/StateMap"

import { State } from "../state/State"


function createManualScheduler() {
  let flush: (() => void) | undefined
  let calls = 0

  return {
    scheduler: (callback: () => void) => {
      calls++
      flush = callback
    },
    flush: () => flush?.(),
    calls: () => calls
  }
}

describe("State.batch", () => {
  it("should flush synchronously without a scheduler", () => {
    const first = new State("John")
    const last = new State("Doe")
    const full = State.combine([first, last], (first, last) => `${first} ${last}`)
    const seen: string[] = []

    full.subscribe(value => seen.push(value))
    const result = State.batch(() => {
      first.set("Jane")
      last.set("Roe")
      return "done"
    })

    expect(result).toBe("done")
    expect(full.get()).toBe("Jane Roe")
    expect(seen).toEqual(["Jane Roe"])
  })

  it("should notify each signal once with its final value", () => {
    const state = new State(0)
    const seen: number[] = []

    state.subscribe(value => seen.push(value))
    State.batch(() => {
      state.set(1)
      state.set(2)
      state.set(3)
    })

    expect(seen).toEqual([3])
  })

  it("should join nested batches into one transaction", () => {
    const state = new State(0)
    const seen: number[] = []

    state.subscribe(value => seen.push(value))
    const result = State.batch(() => {
      state.set(1)
      return State.batch(() => {
        state.set(2)
        return "inner"
      })
    })

    expect(result).toBe("inner")
    expect(seen).toEqual([2])
  })

  it("should capture computed states once per batch", () => {
    const first = new State(1)
    const last = new State(2)
    let computations = 0

    const sum = State.capture(() => {
      computations++
      return first.use() + last.use()
    })
    const seen: number[] = []

    sum.subscribe(value => seen.push(value))
    State.batch(() => {
      first.set(3)
      last.set(4)
    })

    expect(computations).toBe(2)
    expect(seen).toEqual([7])
  })

  it("should defer the flush to the given scheduler", async () => {
    const state = new State(0)
    const seen: number[] = []
    const manual = createManualScheduler()

    state.subscribe(value => seen.push(value))
    const promise = State.batch(() => {
      state.set(1)
      return "scheduled"
    }, manual.scheduler)

    expect(manual.calls()).toBe(1)
    expect(seen).toEqual([])

    manual.flush()
    await expect(promise).resolves.toBe("scheduled")
    expect(seen).toEqual([1])
  })

  it("should use the first scheduler for overlapping batches", async () => {
    const state = new State(0)
    const seen: number[] = []
    const manual = createManualScheduler()
    let frames = 0

    state.subscribe(value => seen.push(value))
    const first = State.batch(() => state.set(1), manual.scheduler)
    const second = State.batch(() => state.set(2), flush => {
      frames++
      flush()
    })

    expect(manual.calls()).toBe(1)
    expect(frames).toBe(0)

    manual.flush()
    await Promise.all([first, second])
    expect(seen).toEqual([2])
  })

  it("should join a pending scheduled transaction from outside a batch", async () => {
    const state = new State(0)
    const seen: number[] = []
    const manual = createManualScheduler()

    state.subscribe(value => seen.push(value))
    const promise = State.batch(() => state.set(1), manual.scheduler)
    state.set(2)

    expect(seen).toEqual([])

    manual.flush()
    await promise
    expect(seen).toEqual([2])
  })

  it("should flush a pending transaction before a synchronous batch", async () => {
    const state = new State(0)
    const seen: number[] = []
    const manual = createManualScheduler()

    state.subscribe(value => seen.push(value))
    const promise = State.batch(() => state.set(1), manual.scheduler)
    const result = State.batch(() => {
      state.set(2)
      return "sync"
    })

    expect(result).toBe("sync")
    expect(seen).toEqual([1, 2])

    manual.flush()
    await promise
    expect(seen).toEqual([1, 2])
  })

  it("should resolve after a synchronous scheduler", async () => {
    const state = new State(0)
    const seen: number[] = []

    state.subscribe(value => seen.push(value))
    const promise = State.batch(() => {
      state.set(1)
      return 5
    }, flush => flush())

    await expect(promise).resolves.toBe(5)
    expect(seen).toEqual([1])
  })

  it("should flush changes before rethrowing a synchronous error", () => {
    const state = new State(0)
    const seen: number[] = []

    state.subscribe(value => seen.push(value))
    expect(() => State.batch(() => {
      state.set(1)
      throw new Error("boom")
    })).toThrow("boom")

    expect(seen).toEqual([1])
  })

  it("should reject after flushing a scheduled error", async () => {
    const state = new State(0)
    const seen: number[] = []

    state.subscribe(value => seen.push(value))
    const promise = State.batch(() => {
      state.set(1)
      throw new Error("boom")
    }, queueMicrotask)

    await expect(promise).rejects.toThrow("boom")
    expect(seen).toEqual([1])
  })

  it("should skip subscribers removed before the flush", async () => {
    const state = new State(0)
    const seen: number[] = []
    const manual = createManualScheduler()

    const subscription = state.subscribe(value => seen.push(value))
    const promise = State.batch(() => state.set(1), manual.scheduler)
    subscription.unsubscribe()

    manual.flush()
    await promise
    expect(seen).toEqual([])
  })

  it("should batch arrays and maps", () => {
    const array = new StateArray<number>([])
    const map = new StateMap<string, number>()
    let arrayCalls = 0
    let mapCalls = 0

    array.subscribe(() => arrayCalls++)
    map.subscribe(() => mapCalls++)

    State.batch(() => {
      array.push(1)
      array.push(2)
      map.set("a", 1)
      map.set("b", 2)
    })

    expect(arrayCalls).toBe(1)
    expect(mapCalls).toBe(1)
    expect(array.get()).toEqual([1, 2])
    expect(map.get("b")).toBe(2)
  })
})
