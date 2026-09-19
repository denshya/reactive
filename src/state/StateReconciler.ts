/**
 * Equality of two items of a reconciled collection: `true` when they represent
 * the same entry, so the previous item's derived values survive the update.
 */
export type ReconcileEquality<T> = (previous: T, next: T) => boolean

function strictEquals(previous: unknown, next: unknown): boolean {
	return previous === next
}

/**
 * Reconciling strategy for `StateArray` derivations.
 *
 * Installed on the source array, it changes how per-item derivations — currently
 * `map` — track updates: items that are "the same" (by `equals`) keep their
 * previously derived values across updates instead of being re-derived. Tama's
 * list rendering pairs this with DOM reconciliation, so surviving rows keep
 * their views and elements untouched.
 *
 * The equality should behave like an equivalence — reflexive, symmetric,
 * position-independent — and derived predicates must be pure with respect to it:
 * equal items must derive equal views, because the predicate runs at most once
 * per surviving item.
 *
 * @example
 * ```ts
 * const rows = new StateArray<Row>([])
 * rows.reconciler = StateReconciler.IDENTITY            // items are stable objects
 * rows.reconciler = new StateReconciler((a, b) => a.id === b.id) // domain identity
 *
 * rows.map(row => <RowView row={row} />) // Now reuses views of surviving rows.
 * ```
 */
export class StateReconciler<T = unknown> {
	/** Strict equality — the common case for collections of stable model objects. */
	static readonly IDENTITY: StateReconciler<any> = new StateReconciler(strictEquals)

	readonly equals: ReconcileEquality<T>

	constructor(equals: ReconcileEquality<T> = strictEquals) {
		this.equals = equals
	}
}

/**
 * Creates the per-update derivation of a reconciled `map`: each call receives the
 * next source values and returns mapped values, reusing survivors' results.
 * Identity equality takes a Map-based O(n) path; custom equality matches the
 * previous items against the next ones pairwise.
 * @internal
 */
export function createReconciledDerivation<T, U>(reconciler: StateReconciler<T>, predicate: (value: T, index: number, array: T[]) => U): (values: T[]) => U[] {
	if (reconciler === StateReconciler.IDENTITY) {
		const cache = new Map<T, U>()

		return (values: T[]) => {
			const memoized = (value: T, index: number, array: T[]) => {
				let mapped = cache.get(value)
				if (mapped === undefined) {
					mapped = predicate(value, index, array)
					cache.set(value, mapped)
				}
				return mapped
			}

			const next = values.map(memoized)

			if (cache.size > values.length) {
				const alive = new Set(values)
				for (const key of cache.keys()) {
					if (alive.has(key as T) === false) cache.delete(key)
				}
			}

			return next
		}
	}

	let previousValues: T[] = []
	let previousMapped: U[] = []

	return (values: T[]) => {
		const consumed = new Array<boolean>(previousValues.length).fill(false)
		const next = new Array<U>(values.length)

		for (let index = 0; index < values.length; index++) {
			const value = values[index]
			let survivor = -1
			for (let candidate = 0; candidate < previousValues.length; candidate++) {
				if (consumed[candidate] === false && reconciler.equals(previousValues[candidate], value)) {
					survivor = candidate
					break
				}
			}

			if (survivor === -1) {
				next[index] = predicate(value, index, values)
				continue
			}

			consumed[survivor] = true
			next[index] = previousMapped[survivor]
		}

		previousValues = values
		previousMapped = next
		return next
	}
}
