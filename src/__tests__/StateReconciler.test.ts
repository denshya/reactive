import { describe, expect, it } from "bun:test"

import { StateArray } from "@/state/StateArray"
import { StateReconciler } from "@/state/StateReconciler"


describe("StateReconciler", () => {
	it("leaves map untouched without a reconciler", () => {
		const rows = new StateArray([{ id: 1 }])

		const views = rows.map(row => ({ view: row.id }))
		const before = views.get()[0]
		rows.set([{ id: 1 }])

		// No strategy — plain `map` re-derives every item on every update.
		expect(views.get()[0]).not.toBe(before)
		expect(views.get()[0].view).toBe(1)
	})

	it("reuses mapped values of identical items across updates", () => {
		const rows = new StateArray([{ id: 1 }, { id: 2 }, { id: 3 }])
		rows.reconciler = StateReconciler.IDENTITY
		const calls: number[] = []

		const views = rows.map(row => {
			calls.push(row.id)
			return { view: row.id }
		})

		const before = views.get()
		expect(calls).toEqual([1, 2, 3])

		rows.set([rows.get()[0], rows.get()[2]])

		const after = views.get()
		expect(after).toHaveLength(2)
		expect(after[0]).toBe(before[0])
		expect(after[1]).toBe(before[2])
		expect(calls).toEqual([1, 2, 3]) // The predicate did not re-run for survivors.
	})

	it("derives only appended items", () => {
		const rows = new StateArray(["a"])
		rows.reconciler = StateReconciler.IDENTITY
		let calls = 0

		const views = rows.map(value => {
			calls++
			return value.toUpperCase()
		})
		expect(calls).toBe(1)

		rows.set([...rows.get(), "b", "c"])

		expect(views.get()).toEqual(["A", "B", "C"])
		expect(calls).toBe(3)
	})

	it("reuses one mapped value for duplicated items", () => {
		const item = { id: 1 }
		const rows = new StateArray([item, item])
		rows.reconciler = StateReconciler.IDENTITY
		let calls = 0

		const views = rows.map(row => {
			calls++
			return { view: row.id }
		})

		const view = views.get()
		expect(calls).toBe(1)
		expect(view[0]).toBe(view[1])
	})

	it("forgets mapped values of removed items (Map prune)", () => {
		const rows = new StateArray([{ id: 1 }, { id: 2 }])
		rows.reconciler = StateReconciler.IDENTITY
		const firstMapped: unknown[] = []

		rows.reconciler = StateReconciler.IDENTITY
		const views = rows.map(row => {
			const mapped = { view: row.id }
			firstMapped[row.id] ??= mapped
			return mapped
		})

		rows.set([rows.get()[0]])
		rows.set([...rows.get(), { id: 2 }])

		expect(views.get()[1]).not.toBe(firstMapped[2])
	})

	it("matches survivors by custom equality, not identity", () => {
		const rows = new StateArray<{ id: number, label: string }>([{ id: 1, label: "a" }])
		rows.reconciler = new StateReconciler((a, b) => a.id === b.id)
		let calls = 0

		const views = rows.map(row => {
			calls++
			return { view: row.id }
		})

		expect(calls).toBe(1)

		// Replacement object, same domain identity — the mapped value survives.
		rows.set([{ id: 1, label: "b" }])
		expect(calls).toBe(1)
		expect(views.get()[0]).toEqual({ view: 1 })
	})

	it("pairs each survivor at most once with duplicated items", () => {
		const rows = new StateArray<{ id: number }>([])
		rows.reconciler = new StateReconciler((a, b) => a.id === b.id)
		let calls = 0

		const views = rows.map(row => {
			calls++
			return row.id
		})

		rows.set([{ id: 7 }, { id: 7 }])
		expect(views.get()).toEqual([7, 7])
		expect(calls).toBe(2) // Two positions, two derivations — no cross-feeding.
	})

	it("propagates the strategy through chained maps", () => {
		const rows = new StateArray([{ id: 1 }])
		rows.reconciler = StateReconciler.IDENTITY

		let innerCalls = 0
		let outerCalls = 0

		const views = rows
			.map(row => {
				innerCalls++
				return { id: row.id }
			})
			.map(row => {
				outerCalls++
				return { id: row.id * 10 }
			})

		expect(views.get()).toEqual([{ id: 10 }])

		rows.set([rows.get()[0], { id: 2 }])

		// 1 initial + 1 genuinely new item on each level — the survivor re-derived on neither.
		expect(innerCalls).toBe(2)
		expect(outerCalls).toBe(2)
		expect(views.get()).toEqual([{ id: 10 }, { id: 20 }])
	})

	it("keeps map updates flowing from push and splice", () => {
		const rows = new StateArray<number>([])
		rows.reconciler = StateReconciler.IDENTITY

		const views = rows.map(value => value + 1)

		rows.push(1)
		expect(views.get()).toEqual([2])

		rows.splice(0, 1)
		expect(views.get()).toEqual([])
	})
})
