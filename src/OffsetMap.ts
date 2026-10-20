const SLOT = Symbol("OffsetMap.slot")

interface Slot { [SLOT]?: number }

/**
 * Insertion-ordered key-value storage backed by one offset array:
 * `[key0, value0, key1, value1, ...]`.
 *
 * Pending entries live between `head` and `tail`. The owner advances `head`
 * and resets both pointers when the range is empty. The array is never cleared,
 * so its allocation is reused. Keys are expected to be extensible objects.
 * @internal
 */
export class OffsetMap<K extends object, V> {
  readonly entries: Array<K | V> = []
  head = 0
  tail = 0

  get size() { return (this.tail - this.head) / 2 }

  set(key: K, value: V) {
    const slot = (key as Slot)[SLOT]
    if (slot !== undefined && slot >= this.head && slot < this.tail && this.entries[slot] === key) {
      this.entries[slot + 1] = value
      return
    }

    this.entries[this.tail] = key
    this.entries[this.tail + 1] = value
    ;(key as Slot)[SLOT] = this.tail
    this.tail += 2
  }
}
