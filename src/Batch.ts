import { OffsetMap } from "./OffsetMap"

export type BatchScheduler = (flush: () => void) => unknown

interface BatchFailure { error: unknown }
interface BatchCompletion {
  value: unknown
  error: BatchFailure | null
  resolve: (value: any) => void
  reject: (reason?: any) => void
}

export class Batcher {
  private static readonly queue = new OffsetMap<object, () => void>()
  private static readonly completions: BatchCompletion[] = []
  private static completionPointer = 0

  private static depth = 0
  private static scheduled = false
  private static scheduledToken = 0

  /** @internal */
  static isBatching(): boolean { return Batcher.depth > 0 || Batcher.scheduled }

  // Queues one flush per `key`. A stable key keeps repeated writes from the same
  // signal or closure from producing more than one notification.
  /** @internal */
  static enqueue(key: object, flush: () => void): void {
    if (Batcher.isBatching()) Batcher.queue.set(key, flush)
    else flush()
  }

  /**
   * Merges signals into a single transaction,
   * notifies each one with a final value once.
   */
  static batch<T>(closure: () => T): T
  static batch<T>(closure: () => T, scheduler: BatchScheduler): Promise<T>
  static batch<T>(closure: () => T, scheduler?: BatchScheduler): T | Promise<T> {
    // A synchronous batch must not be delayed by a scheduler requested elsewhere.
    if (Batcher.depth === 0 && Batcher.scheduled && scheduler == null) {
      Batcher.flushScheduled()
    }

    Batcher.depth++

    let value!: T
    let failure: BatchFailure | null = null
    try {
      value = closure()
    } catch (error) {
      failure = { error }
    } finally {
      Batcher.depth--
    }

    if (Batcher.depth > 0) {
      if (scheduler == null) {
        if (failure) throw failure.error
        return value
      }

      return new Promise<T>((resolve, reject) => {
        Batcher.completions[Batcher.completionPointer++] = { value, error: failure, resolve, reject }
      })
    }

    if (scheduler == null) {
      const flushFailure = Batcher.flushSync()

      if (failure) throw failure.error
      if (flushFailure) throw flushFailure.error
      return value
    }

    const promise = new Promise<T>((resolve, reject) => {
      Batcher.completions[Batcher.completionPointer++] = { value, error: failure, resolve, reject }
    })

    // A pending transaction already owns the flush scheduler.
    if (Batcher.scheduled === false) Batcher.schedule(scheduler)

    return promise
  }

  private static schedule(scheduler: BatchScheduler) {
    Batcher.scheduled = true
    const token = ++Batcher.scheduledToken
    const isCurrent = () => Batcher.scheduled !== false && token === Batcher.scheduledToken
    const flush = () => {
      if (isCurrent() === false) return
      Batcher.flushScheduled()
    }

    try {
      scheduler(flush)
    } catch (error) {
      if (isCurrent() === false) return

      Batcher.scheduled = false
      Batcher.scheduledToken++

      try { Batcher.flushQueue() } catch { }
      Batcher.settle({ error })
    }
  }

  private static flushQueue() {
    Batcher.depth++

    let failure: BatchFailure | null = null
    try {
      const queue = Batcher.queue

      // Each pass only processes entries present at its start. Work enqueued
      // by these flushes is handled on the next pass, so derived signals still
      // see every source update before they notify.
      while (queue.head < queue.tail) {
        const end = queue.tail

        for (let index = queue.head; index < end; index += 2) {
          const flush = queue.entries[index + 1] as () => void
          queue.head = index + 2

          try {
            flush()
          } catch (error) {
            failure ??= { error }
          }
        }
      }

      queue.head = 0
      queue.tail = 0
    } finally {
      Batcher.depth--
    }

    if (failure) throw (failure as BatchFailure).error
  }

  private static flushSync() {
    let failure: BatchFailure | null = null
    try {
      Batcher.flushQueue()
    } catch (error) {
      failure = { error }
    }

    Batcher.settle(failure)
    return failure
  }

  private static flushScheduled() {
    Batcher.scheduled = false

    let failure: BatchFailure | null = null
    try {
      Batcher.flushQueue()
    } catch (error) {
      failure = { error }
    }

    const pending = Batcher.completionPointer
    Batcher.settle(failure)

    // Without a pending promise there is nobody to reject, so surface the error.
    if (failure && pending === 0) throw failure.error
  }

  private static settle(failure: BatchFailure | null) {
    const completions = Batcher.completions
    try {
      for (let index = 0; index < Batcher.completionPointer; index++) {
        const completion = completions[index]
        const error = completion.error ?? failure
        if (error) completion.reject(error.error)
        else completion.resolve(completion.value)
      }
    } finally {
      Batcher.completionPointer = 0
    }
  }
}
