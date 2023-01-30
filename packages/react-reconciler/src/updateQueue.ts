import { Action } from "shared/ReactTypes";
import { Dispatch } from "react/src/currentDispatcher";
import { Lane } from "./fiberLanes";

/**
 * 更新方式
 * this.setState(xxx) / this.setState(x => xx)
 */
export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

/**
 * 创建更新
 * @param {Action<State>} action
 * @returns {Update<State>}
 */
export const createUpdate = <State>(
  action: Action<State>,
  lane: Lane
): Update<State> => {
  return {
    action,
    lane,
    next: null,
  };
};

/**
 * 初始化updateQueue
 * @returns {UpdateQueue<Action>}
 */
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null,
    },
    dispatch: null,
  } as UpdateQueue<State>;
};

/**
 * 更新update
 * @param {UpdateQueue<Action>} updateQueue
 * @param {Update<Action>} update
 */
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    // 第一次执行update pending = a -> a
    update.next = update;
  } else {
    // 第二个update pending = b -> a -> b
    // 第三个update pending = c -> a -> b -> c
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;
};

/**
 * 消费updateQueue(计算状态的最新值）
 */
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): {
  memoizedState: State;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
  };
  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;
    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        const action = pending.action;
        if (action instanceof Function) {
          // baseState 1 update (x) => 4x  -> memoizedState 4
          baseState = action(baseState);
        } else {
          // baseState 1 update 2 -> memoizedState 2
          baseState = action;
        }
      } else {
        if (__DEV__) {
          console.error("不应该进入processUpdateQueue");
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);
  }
  result.memoizedState = baseState;
  return result;
};
