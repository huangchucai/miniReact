import { FiberNode } from "./fiber";
import internals from "shared/internals";
import { Dispatcher } from "react/src/currentDispatcher";
import { Dispatch } from "react/src/currentDispatcher";
import { createUpdateQueue } from "./updateQueue";

let currentlyRenderingFiber: FiberNode | null = null; // 记录当前正在执行的render 的FC 对应的fiberNode
let workInProgressHook: Hook | null = null; // 当前正在处理的hook
const { currentDispatcher } = internals;

interface Hook {
  memoizedState: any;
  updateQueue: unknown;
  next: Hook | null;
}

export function renderWithHooks(wip: FiberNode) {
  // 赋值操作
  currentlyRenderingFiber = wip;
  // 重置
  wip.memoizedState = null;

  const current = wip.alternate;
  if (current !== null) {
    // update
  } else {
    // mount
    currentDispatcher.current = HooksDispatcherOnMount;
  }

  const Component = wip.type;
  const props = wip.pendingProps;
  const children = Component(props);

  // 重置操作
  currentlyRenderingFiber = null;
  return children;
}

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
};

function mountState<State>(
  initialState: (() => State) | State
): [State, Dispatch<State>] {
  // 找到当前useState对应的hook数据
  const hook = mountWorkInProgressHook();

  let memoizedState;
  if (initialState instanceof Function) {
    memoizedState = initialState();
  } else {
    memoizedState = initialState;
  }

  // useState是可以触发更新的
  const queue = createUpdateQueue<State>();
  hook.updateQueue = queue;

  //todo dispatch实现

  return [memoizedState, dispatch];
}

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    updateQueue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    // mount时，第一个hook
    if (currentlyRenderingFiber === null) {
      throw new Error("请在函数组件内调用hook");
    } else {
      workInProgressHook = hook;
      currentlyRenderingFiber.memoizedState = workInProgressHook;
    }
  } else {
    // mount时，后续的hook
    workInProgressHook.next = hook;
    workInProgressHook = hook;
  }
  return workInProgressHook;
}
