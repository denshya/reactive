import { State } from "./State"

export class StateBoolean extends State<boolean> {
  private static readonly TOGGLE_FUNCTION = (value: boolean) => !value

  toggle(): void { this.set(StateBoolean.TOGGLE_FUNCTION) }
  /** Returns a state with the negated value that follows this state. */
  get negated(): State<boolean> { return this.to(StateBoolean.TOGGLE_FUNCTION) }
}
