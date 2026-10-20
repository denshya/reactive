import "./REQUIRED_SYMBOLS"

declare global {
  interface SymbolConstructor {
    readonly subscribe: unique symbol
  }
}

export { }
