import { SignalReadonly } from "./Flow"
import { State } from "./state/State"
import { isObservableGetter } from "./utils"

export class FlowModel<T> extends SignalReadonly<T> {
  commit(): void {
    this.messager.dispatch(this.value)
  }
}

export namespace FlowModel {
  export function Collection<T extends FlowModel<unknown>>(target: new (...args: unknown[]) => T): any {
    return function (...args: any[]) {
      const model = new target(...args)
      const modelState = model.get() as any

      for (const key of Object.keys(modelState)) {
        const modelProperty = (model as any)[key]
        if (isObservableGetter(modelProperty)) return

        State.subscribe(modelProperty, propertyValue => {
          modelState[key] = propertyValue
          model.commit()
        })
      }
      return model
    }
  }
}