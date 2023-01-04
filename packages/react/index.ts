import { jsx, jsxDEV, isValidElement as isValidElementFn } from "./src/jsx";
import currentDispatcher, {
  Dispatcher,
  resolveDispatcher,
} from "./src/currentDispatcher";

export const useState: Dispatcher["useState"] = (initialState: any) => {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
};

export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = {
  currentDispatcher,
};

export const isValidElement = isValidElementFn;
export const version = "0.0.0";
// TODO 根据环境区分使用jsx/jesDEV
export const createElement = jsx;
