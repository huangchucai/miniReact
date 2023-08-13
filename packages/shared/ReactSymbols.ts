const supportSymbol = typeof Symbol === "function" && Symbol.for;
/**
 * ReactElement 的type 属性
 */
export const REACT_ELEMENT_TYPE = supportSymbol
  ? Symbol.for("react.element")
  : 0xeac7;

export const REACT_FRAGMENT_TYPE = supportSymbol
  ? Symbol.for("react.fragment")
  : 0xeacb;

export const REACT_CONTEXT_TYPE = supportSymbol
  ? Symbol.for("react.context")
  : 0xea5e;

export const REACT_PROVIDER_TYPE = supportSymbol
  ? Symbol.for("react.provider")
  : 0xea51;

export const REACT_SUSPENSE_TYPE = supportSymbol
  ? Symbol.for("react.suspense")
  : 0xea4c;
