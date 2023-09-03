export type Type = any;
export type Key = any;
export type Ref = { current: any } | ((instance: any) => void);
export type Props = any;
export type ElementType = any;

export interface ReactElementType {
  $$typeof: symbol | number;
  type: ElementType;
  key: Key;
  props: Props;
  ref: Ref;
  __mark: string;
}

export type Action<State> = State | ((prevState: State) => State);

export type ReactContext<T> = {
  $$typeof: symbol | number;
  Provider: ReactProviderType<T> | null;
  _currentValue: T;
};

export type ReactProviderType<T> = {
  $$typeof: symbol | number;
  _context: ReactContext<T>;
};

export type Usable<T> = Thenable<T> | ReactContext<T>;

/**
 * 唤起更新的意思
 */
export interface Wakeable<Result = any> {
  then(
    onFulfill: () => Result,
    onReject: () => Result
  ): void | Wakeable<Result>;
}

interface ThenableImpl<T, Result, Err> {
  then(
    onFulfill: (value: T) => Result,
    onReject: (error: Err) => Result
  ): void | Wakeable<Result>;
}

interface UntrackedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status?: void;
}

export interface PendingThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: "pending";
}

export interface FulfilledThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: "fulfilled";
  value: T;
}

export interface RejectedThenable<T, Result, Err>
  extends ThenableImpl<T, Result, Err> {
  status: "rejected";
  reason: Err;
}

// 1. untracked: 没有追踪到的状态
// 2. pending: promise的pending状态
// 3. fulfilled: promise的resolved状态
// 4. rejected: promise的rejected状态
export type Thenable<T, Result = void, Err = any> =
  | UntrackedThenable<T, Result, Err>
  | PendingThenable<T, Result, Err>
  | FulfilledThenable<T, Result, Err>
  | RejectedThenable<T, Result, Err>;
