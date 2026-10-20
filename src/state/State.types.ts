import { ObservableGetter } from "@/Flow"
import { ObservableLike } from "@/types"


export type StateLike<T> = ObservableGetter<T> | ObservableLike<T>
export type StateOrPlain<T> = T | StateLike<T>
