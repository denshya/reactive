# Reactive

Signal-based Reactive Data Modeling and Management.

This is a Reactivity Primitives Library, a uniform system that tries to comprehend industry standards.
It supports two kind of `Signal`s ([`EventSignal`](https://github.com/FrameMuse/event-signal) and [`ClosureSignal`](https://github.com/FrameMuse/closure-signal)), gives utils to ease reactivity rather than piping.

## Getting Started with `State`

### Quick Peek

```ts
import { State, StateArray, Notifier } from "@denshya/reactive"

const blog = {
  articles: new StateArray([{
    title: "",
    description: ""
  }]),
  user: new State({
    id: 1,
    name: "FrameMuse"
  }),
  admin: {
    enabled: new State(false),
    save: new Notifier,
    cancel: new Notifier,
  }
}

blog.articles.push({
  title: "How to use `Reactive`",
  description: "Follow our guides..."
})

blog.admin.enabled.set(true) // Active admin UI.

blog.admin.save.subscribe(() => fetch("/blog", { method: "POST", body: JSON.stringify(blog) }))
blog.admin.save.dispatch() // e.g. Button triggers saving.

blog.user.set({ id: 2, name: "Denshya" }) // Replace user.
blog.user.$.name.set("Reactive") // Partial change.
```

> [!Note]
> Updating a state doesn't cause updates to other ones.

> [!Tip]
> It's similar but more powerful than <https://tanstack.com/store/latest/docs/overview>

### `State` comprehends two types of `Signal`

Using event-based signals

```ts
import { State } from "@denshya/reactive"

const balance = new State(0)
const income = new State(100)
const debt = new State(500)

const salary = income.to(it => it / 2)
salary.subscribe(salary => balance.set(it => it + salary))

const netWorth = balance.to(balance => balance - debt)
```

Using closure-based ones

```ts
import { State } from "@denshya/reactive"

const balance = new State(0)
const income = new State(100)
const debt = new State(500)

const salary = State.capture(() => income.use() / 2)
State.capture(() => {
  balance.set(balance.get() + salary.use())
})

const netWorth = State.capture(() => balance.use() - debt.use())
```

`State` modes are **interchangeable**, so you can use both together.

## Transforms

### `state.to`

`to` method is `map` function under a different name because `state.map(x => x.map(e => e))` seems a bit weird.
And it looks neat as Tacit programming - `string.to(Number)`

It creates a new `State` instance, transforms the value and assign it to the new instance.

It is useful when you want to select a value, but save reactivity:

```ts
import { State } from "@denshya/reactive"

const ypx = new State("15px")
const y = ypx.to(parseFloat)

ypx.set("16px") // Will set `y` to `16`.
y.set(15) // Will not affect `ypx`.
```

### `state.from`

It exposes `set` method that hooks to places where Signal-like structures required

It is useful when you want to fit "source" (or "sink") from where a new value is coming to a desired one:

```ts
import { State } from "@denshya/reactive"

const pointerX = new State(0)

window.addEventListener("pointermove", pointerX.from(event => event.x))
window.when("pointermove").subscribe(pointerX.from(event => event.x))

const event = new State(new PointerEvent(""))
event.sets(pointerX.from(event => event.x))
```

This literally says "`event` sets `value` from `event.currentTarget.value`".

## Batching

`State.batch` groups multiple writes so subscribers are notified once with the final values.

```ts
import { State } from "@denshya/reactive"

const first = new State("John")
const last = new State("Doe")
const full = State.combine([first, last], (first, last) => `${first} ${last}`)

full.subscribe(console.log) // Logs once with "Jane Roe".

State.batch(() => {
  first.set("Jane")
  last.set("Roe")
})
```

By default the batch flushes before `State.batch` returns. Pass a scheduler to defer the flush:

```ts
await State.batch(() => {
  first.set("Janet")
  last.set("Doe")
}, queueMicrotask)

await State.batch(() => {
  first.set("Jan")
}, requestAnimationFrame)
```

A scheduler receives the flush callback and may run it immediately, in a microtask, or before the next frame. When a scheduler is passed, `State.batch` returns a promise that resolves after the flush with the closure's return value. Nested batches join the outer transaction.

## Access properties

```ts
import { State } from "@denshya/reactive"

const app = new State({ user: { name: "test" } })
// Regular Access
app.get().user.name
app.current.user.name
// Observable Access
app.$.user.$.name.subscribe(console.log) // Logs `app.user.name` changes.
// Usage of `$` is cached and an observable for accessed property only created when first accessed.
app.$.user === app.$.user // true
```

## `State` Static methods

```ts
import { State } from "@denshya/reactive"

/** Captures every `use()` that appear in the closure and subscribes to their updates produces new value. */
State.capture(() => state1.use() + state2.use())
/** Combines several state-like values into one with a strategy. */
State.combine([state1, state2], (state1, state2) => state1 + state2)
/** Finds all (shallow) values in `Record` or `Array` and outputs it `State` with unwrapped values. */
State.collect([state1, state2]) // Reduces to e.g. `State<[number, number]>` from `[State<number>, State<number>]`
State.collect({ foo: state1, bar: state2 }) // Reduces to `State<{ foo: number, bar: number }>`

/** Builds a string state from string template of observables. */
State.f`display: ${style.$.display}; opacity: ${1}`
/** Creates `State` from a plain value or forks from existing one. */
State.from(...)
/** Groups writes and notifies each changed state once with its final value. */
State.batch(() => { ... })
/** Unwraps any Signal-like structure. */
State.get(...)
/** Uses any Signal-like structure (even third-party) as `ClosureSignal` - can be used in `State.capture`. */
State.use(signalLike)
/** Subscribes to any Signal-like structure. */
State.subscribe(signalLike, () => {...})
/** Subscribes to any Signal-like structure and invokes `callback` immediately once. */
State.subscribeImmediate(signalLike, () => {...})
```

## `StateArray`

An array representation of `State`, it has more convenient `at` and `push` methods, and new one `delete`.

```ts
import { State, StateArray } from "@denshya/reactive"

const array = new StateArray([1,2,3])
array.subscribe(console.log) // Logs `array` changes.

array.set([1,2,3,4])
array.push(5) // Triggers update.
array.at(2) // Returns an observable that reflects the value at desired index.

// Index can also be observable.
const index = new State(1)
array.at(index)

array.delete(2) // Triggers update.
console.log(array.get()) // [1,2,4,5]
```

However, you can still use `State` with arrays by using `$[index]`, it will still work but not so comfortable.

## `StateMap`

A `Map` that notifies subscribers after every mutation.

```ts
import { State, StateMap } from "@denshya/reactive"

const users = new StateMap([[1, { name: "FrameMuse" }]])
users.subscribe(console.log) // Logs `users` changes.

users.set(2, { name: "Denshya" })
users.delete(1)
users.clear()

// A key can be observable.
const selectedId = new State(2)
const selected = users.get$(selectedId) // State of the selected user.
```

## `StateFSM`

Finite State Machine, based on `Signal` and `Emitter`.

```ts
const character = {
  state: new StateFSM<"idle" | "walking" | "running">("idle")
}

state.when("idle").subscribe(() => {...})
state.when("walking").subscribe(() => {...})
state.subscribe(state => state === "idle" && idle())
state.set("walking")
```

## Third-part Sourcing

If reactive source is third-party, you can use `.from` method that is present on many class constructors
like `State`, `StateArray`, etc. to convert the third-party to canonical.

Something like `StateArray.from(state)` can be used to copy values too.

```ts
const someState = new State([1,2,3])
const stateArray = StateArray.from(someState) // => [1,2,3]
```

```ts
import { State } from "@denshya/reactive"

const state = State.from({
  #value: 1,
  subscribe(next: (value: number) => void) {
    const id = setInterval(() => next(this.#value + 1), 1000)
    return () => clearInterval(id)
  }
})
state // => `State` instance.
```

## Serialization

`State` (and other) has hidden `toJSON` method, which outputs actual value for serialization.

```ts
import { State, StateArray } from "@denshya/reactive"

const bool = new State(true)
const string = new State("text")
const record = new State({foo:"bar"})
const array = new StateArray([1,2,3])

JSON.stringify({ bool, string, record, array })
```

=>

```json
{
  "bool": true,
  "string": "text",
  "record": { "foo" : "bar" },
  "array": [1, 2, 3]
}
```

## Unsubscribing

All subscriptions follow [WICG Observable API proposal](https://github.com/WICG/observable) and thus return object (record) with callback to unsubscribe.

```ts
const state = new State(123)
const subscription = state.subscribe(() => {...})

subscription.unsubscribe()
```

However, this library handles multiple variations of subscriptions/unsubscribe if it's reasonable.
e.g. `State.subscribe(signalLike, () => {...})` will return `subscription` just like in the example above,
even if `signalLike.subscribe` returns different one.

## Other Primitives

### `Messager`

Dispatcher for single messages. Useful for building custom `Signal`-like structures.

### `Notifier`

Is a `Messager` but only for empty messages. Use for semantics.

### `Emitter`

A key-based event messager, usually known as Event Emitter.

```ts
import { Emitter } from "@denshya/reactive"

interface Events {
  add: number
}

const emitter = new Emitter<Events>
emitter.when("add").subscribe(console.log) // Logs `add` events.
emitter.dispatch("add", 1)
```
