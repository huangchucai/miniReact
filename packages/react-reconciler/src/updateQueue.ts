import { Action } from "shared/ReactTypes";
import { Dispatch } from "react/src/currentDispatcher";
import { isSubsetOfLanes, Lane, NoLane } from "./fiberLanes";

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
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null,
  };
  if (pendingUpdate !== null) {
    // 第一个update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    let newBaseState = baseState; // 最后一个没被跳过update计算后的结果
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState; // 每次计算一次的结果

    do {
      const updateLane = pending.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够被跳过
        const clone = createUpdate(pending.action, pending.lane); // clone被跳过的update
        // 判断是不是第一个被跳过的
        if (newBaseQueueFirst === null) {
          // first u0 last u0
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          // 如果本次更新有update被跳过, baseState为「最后一个没被跳过的update计算后的结果」
          newBaseState = newState;
        } else {
          // first u0 last u0
          // last u0 -> u1
          // last u1
          // 不是第一个被跳过的
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级足够
        if (newBaseQueueFirst !== null) {
          // 本次更新「被跳过的update及其后面的所有update」都会被保存在baseQueue中参与下次state计算
          // 本次更新「参与计算但保存在baseQueue中的update」，优先级会降低到NoLane
          const clone = createUpdate(pending.action, NoLane);
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }

        const action = pending.action;
        if (action instanceof Function) {
          // baseState 1 update (x) => 4x  -> memoizedState 4
          newState = action(baseState);
        } else {
          // baseState 1 update 2 -> memoizedState 2
          newState = action;
        }
      }
      pending = pending.next as Update<any>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有update被跳过
      newBaseState = newState;
    } else {
      // 本次计算有update被跳过
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memoizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }
  return result;
};
