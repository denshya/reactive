/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */

import { RefReadonly } from "@/ValueReference"

import { Batcher } from "../Batch"

// https://www.youtube.com/watch?v=vHy7GRpTpm8&list=LL&index=3&t=514s
// https://codesandbox.io/s/0xyqf?file=/reactive.js:0-1088

/** A `Dependencies` has many different Subscribers depending on it. */
type ClosureDependencies = Set<ClosureCaptor>
/** A particular Subscriber has many Dependencies */
export interface ClosureCaptor {
  capture(): void
  dependencies: Set<ClosureDependencies>
}





export class ClosureCaptor {
  dependencies = new Set<ClosureDependencies>

  private pending = false

  constructor(private readonly closure: () => void) { }

  captureBatched() {
    if (Batcher.isBatching() === false) {
      this.capture()
      return
    }

    if (this.pending) return

    this.pending = true
    Batcher.enqueue(this, () => {
      this.pending = false
      this.capture()
    })
  }

  capture() {
    ClosureCaptor.dispose(this)
    ClosureCaptor.subscribers.push(this)

    try {
      this.closure()
    } finally {
      ClosureCaptor.subscribers.pop()
    }
  }

  static readonly subscribers: ClosureCaptor[] = []
  /** Retrieves current (last) subscriber. */
  static getCurrent() { return ClosureCaptor.subscribers.at(-1) }
  static dispose(subscriber: ClosureCaptor) {
    for (const dependency of subscriber.dependencies) {
      dependency.delete(subscriber)
    }

    subscriber.dependencies.clear()
  }
}

export class ClosureParticipant {
  private readonly dependencies: ClosureDependencies = new Set

  /** Attaches this participant to the current closure captor. */
  attach() {
    const captor = ClosureCaptor.getCurrent()
    if (captor == null) return

    this.dependencies.add(captor)
    captor.dependencies.add(this.dependencies)
  }

  /** Executes previously attached captors. */
  dispatch() {
    for (const subscriber of [...this.dependencies]) {
      subscriber.captureBatched()
    }
  }
}



export namespace ClosureSignal {
  export class State<T> implements RefReadonly<T> {
    private value: T
    private closureParticipant = new ClosureParticipant

    get current() { return this.value }

    constructor(initialValue: T) { this.value = initialValue }

    get(): T {
      this.closureParticipant.attach()
      return this.value
    }

    set(nextValue: T): void {
      this.value = nextValue
      this.closureParticipant.dispatch()
    }
  }
  export class Computed<T> implements RefReadonly<T> {
    private readonly state: State<T>
    constructor(factoryClosure: () => T) {
      this.state = new State<T>(null as never) // Assume it will be actually initiated before first get.

      const closure = () => this.state.set(factoryClosure())

      new ClosureCaptor(closure).capture()
    }

    // @ts-expect-error private `value`.
    get(): T { return this.state.value }
    // @ts-expect-error private `value`.
    get current() { return this.value }
  }
}
