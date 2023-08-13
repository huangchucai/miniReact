import {
  jsx,
  jsxDEV,
  isValidElement as isValidElementFn,
  Fragment as fragment,
} from "./src/jsx";

export { REACT_SUSPENSE_TYPE as Suspense } from "shared/ReactSymbols";

import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from "./src/currentDispatcher";

export { createContext } from "./src/context";

import currentBatchConfig from "./src/currentBatchConfig";

export const useState: Dispatcher["useState"] = (initialState: any) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const useEffect: Dispatcher["useEffect"] = (create, deps) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
};

export const useTransition: Dispatcher["useTransition"] = () => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
};

export const useRef: Dispatcher["useRef"] = (initialValue) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
};

export const useContext: Dispatcher["useContext"] = (context) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(context);
};
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
  currentBatchConfig,
};

export const isValidElement = isValidElementFn;
export const version = "0.0.0";
// TODO 根据环境区分使用jsx/jesDEV
export const createElement = jsx;
export const Fragment = fragment;
