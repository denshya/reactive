import { describe, expect, it } from "bun:test"

import { OffsetMap } from "../OffsetMap"


describe("OffsetMap", () => {
  it("should keep insertion order and update existing keys in place", () => {
    const queue = new OffsetMap<object, number>()
    const first = {}
    const second = {}

    queue.set(first, 1)
    queue.set(second, 2)
    queue.set(first, 3)

    expect(queue.size).toBe(2)
    expect(queue.entries.slice(0, queue.tail)).toEqual([first, 3, second, 2])
  })

  it("should append a processed key instead of reusing its old slot", () => {
    const queue = new OffsetMap<object, number>()
    const first = {}
    const second = {}

    queue.set(first, 1)
    queue.set(second, 2)
    queue.head = 2
    queue.set(first, 3)

    expect(queue.entries.slice(queue.head, queue.tail)).toEqual([second, 2, first, 3])
  })

  it("should report the pending size", () => {
    const queue = new OffsetMap<object, number>()

    queue.set({}, 1)
    expect(queue.size).toBe(1)

    queue.head = queue.tail
    expect(queue.size).toBe(0)
  })
})
