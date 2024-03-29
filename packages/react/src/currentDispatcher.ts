import { Action, ReactContext, Usable } from "shared/ReactTypes";

export interface Dispatcher {
  useState: <T>(initialState: (() => T) | T) => [T, Dispatch<T>];
  useEffect: (callback: () => void, deps: any[] | void) => void;
  useTransition: () => [boolean, (callback: () => void) => void];
  useRef: <T>(initialValue: T) => { current: T };
  useContext: <T>(context: ReactContext<T>) => T;
  use: <T>(usable: Usable<T>) => T;
}

export type Dispatch<State> = (action: Action<State>) => void;
/**
 当前使用的hook集合
 */
const currentDispatcher: {
  current: Dispatcher | null;
} = {
  current: null,
};

export const resolveDispatcher = (): Dispatcher => {
  const dispatcher = currentDispatcher.current;

  if (dispatcher === null) {
    throw new Error("hook只能在函数中执行");
  }
  return dispatcher;
};

export default currentDispatcher;
