import { describe, expect, it } from "bun:test"

import { StateFSM } from "../state/StateFSM"


describe("StateFSM", () => {
  it("should notify subscribers of the next state", () => {
    const state = new StateFSM<"idle" | "walking" | "running">("idle")
    const seen: string[] = []

    state.when("walking").subscribe(() => seen.push("walking"))
    state.when("running").subscribe(() => seen.push("running"))

    state.set("walking")
    state.set("running")
    state.set("idle")

    expect(seen).toEqual(["walking", "running"])
  })
})
