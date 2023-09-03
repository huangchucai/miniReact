import {
  createFiberFromFragment,
  createFiberFromOffscreen,
  createWorkInProgress,
  FiberNode,
  OffscreenProps,
} from "./fiber";
import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
  SuspenseComponent,
} from "./workTags";
import { processUpdateQueue, UpdateQueue } from "./updateQueue";
import { ReactElementType } from "shared/ReactTypes";
import { mountChildFibers, reconcileChildFibers } from "./childFibers";
import { renderWithHooks } from "./fiberHooks";
import { Lane } from "./fiberLanes";
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref,
} from "./fiberFlags";
import { pushProvider } from "./fiberContext";
import { pushSuspenseHandler } from "./suspenseContext";

/**
 * 递归中的递阶段
 * 比较 然后返回子fiberNode 或者null
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  console.log("-hcc-beginWork---", wip);
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip, renderLane);
    case HostComponent:
      return updateHostComponent(wip);
    case FunctionComponent:
      return updateFunctionComponent(wip, renderLane);
    case HostText:
      // 文本节点没有子节点，所以没有流程
      return null;
    case Fragment:
      return updateFragment(wip);
    case ContextProvider:
      return updateContextProvider(wip);
    case SuspenseComponent:
      return updateSuspenseComponent(wip);
    case OffscreenComponent:
      return updateOffscreenComponent(wip);
    default:
      if (__DEV__) {
        console.warn("beginWork未实现的类型");
      }
      break;
  }
  return null;
};

/**
 * hostRoot的beginWork工作流程
 * 1. 计算状态的最新值  2. 创造子fiberNode
 * @param {FiberNode} wip
 */
function updateHostRoot(wip: FiberNode, renderLane: Lane) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<ReactElementType>;
  // 这里是计算最新值
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane); // 最新状态

  const current = wip.alternate;
  if (current !== null) {
    current.memoizedState = memoizedState;
  }

  wip.memoizedState = memoizedState; // 其实就是传入的element

  const nextChildren = wip.memoizedState; // 子对应的ReactElement
  reconcileChildren(wip, nextChildren);
  console.warn("--hostRoot的beginWork工作流程--", wip);
  return wip.child;
}

function updateSuspenseComponent(wip: FiberNode) {
  const current = wip.alternate;
  const nextProps = wip.pendingProps;

  let showFallback = false; // 是否显示fallback
  // const didSuspend = true; // 是否挂起
  const didSuspend = (wip.flags & DidCapture) !== NoFlags; // 是否挂起
  if (didSuspend) {
    // 显示fallback
    showFallback = true;
    wip.flags &= ~DidCapture; // 清除DidCapture
  }

  const nextPrimaryChildren = nextProps.children; // 主渲染的内容
  const nextFallbackChildren = nextProps.fallback;

  pushSuspenseHandler(wip);

  if (current === null) {
    // mount
    if (showFallback) {
      // 挂起
      return mountSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      // 正常
      return mountSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  } else {
    // update
    if (showFallback) {
      // 挂起
      return updateSuspenseFallbackChildren(
        wip,
        nextPrimaryChildren,
        nextFallbackChildren
      );
    } else {
      // 正常
      return updateSuspensePrimaryChildren(wip, nextPrimaryChildren);
    }
  }
}

/**
 * 挂起状态的mount阶段
 * @param wip
 * @param primaryChildren
 * @param fallbackChildren
 */
function mountSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const primaryChildProps: OffscreenProps = {
    mode: "hidden",
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);
  const fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);

  fallbackChildFragment.flags |= Placement; // 标记为插入

  primaryChildFragment.return = wip;
  fallbackChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

/**
 * 正常流程的mount阶段
 * @param wip
 * @param primaryChildren
 */
function mountSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const primaryChildProps: OffscreenProps = {
    mode: "visible",
    children: primaryChildren,
  };
  const primaryChildFragment = createFiberFromOffscreen(primaryChildProps);

  wip.child = primaryChildFragment;
  primaryChildFragment.return = wip;

  return primaryChildFragment;
}

function updateSuspenseFallbackChildren(
  wip: FiberNode,
  primaryChildren: any,
  fallbackChildren: any
) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: "hidden",
    children: primaryChildren,
  };

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );

  let fallbackChildFragment;
  if (currentFallbackChildFragment) {
    fallbackChildFragment = createWorkInProgress(
      currentFallbackChildFragment,
      fallbackChildren
    );
  } else {
    fallbackChildFragment = createFiberFromFragment(fallbackChildren, null);
    fallbackChildFragment.flags |= Placement; // 标记为插入
  }

  fallbackChildFragment.return = wip;
  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = fallbackChildFragment;
  wip.child = primaryChildFragment;

  return fallbackChildFragment;
}

/**
 * 正常流程的更新
 * @param wip
 * @param primaryChildren
 * @param fallbackChildren
 */
function updateSuspensePrimaryChildren(wip: FiberNode, primaryChildren: any) {
  const current = wip.alternate as FiberNode;
  const currentPrimaryChildFragment = current.child as FiberNode;
  const currentFallbackChildFragment: FiberNode | null =
    currentPrimaryChildFragment.sibling;

  const primaryChildProps: OffscreenProps = {
    mode: "visible",
    children: primaryChildren,
  };

  const primaryChildFragment = createWorkInProgress(
    currentPrimaryChildFragment,
    primaryChildProps
  );
  primaryChildFragment.return = wip;
  primaryChildFragment.sibling = null;
  wip.child = primaryChildFragment;

  if (currentFallbackChildFragment) {
    const deletions = wip.deletions;
    if (deletions === null) {
      wip.deletions = [currentFallbackChildFragment];
      wip.flags |= ChildDeletion;
    } else {
      deletions.push(currentFallbackChildFragment);
    }
  }

  return primaryChildFragment;
}

function updateOffscreenComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

function updateContextProvider(wip: FiberNode) {
  const providerType = wip.type;
  // {
  //   $$typeof: symbol | number;
  //   _context: ReactContext<T>;
  // }
  const context = providerType._context;
  const oldProps = wip.memoizedProps; // 旧的props <Context.Provider value={0}> {value, children}
  const newProps = wip.pendingProps;

  const newValue = newProps.value; // 新的value

  if (oldProps && newValue !== oldProps.value) {
    // context.value发生了变化  向下遍历找到消费的context
    // todo: 从Provider向下DFS，寻找消费了当前变化的context的consumer
    // 如果找到consumer, 从consumer开始向上遍历到Provider
    // 标记沿途的组件存在更新
  }

  // 逻辑 - context入栈
  if (__DEV__ && !("value" in newProps)) {
    console.warn("<Context.Provider>需要传入value");
  }
  pushProvider(context, newValue);

  const nextChildren = newProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * Fragment的beginWork
 * @param wip
 */
function updateFragment(wip: FiberNode) {
  const nextChildren = wip.pendingProps;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 函数组件的beginWork
 * @param wip
 */
function updateFunctionComponent(wip: FiberNode, renderLane: Lane) {
  const nextChildren = renderWithHooks(wip, renderLane);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * HostComponent的beginWork工作流程
 * 1、 创建子fiberNode  <div><span></span></div> span节点在div的props.children 中
 * @param {FiberNode} wip
 */
function updateHostComponent(wip: FiberNode) {
  const nextProps = wip.pendingProps;
  const nextChildren = nextProps.children;
  markRef(wip.alternate, wip);
  reconcileChildren(wip, nextChildren);
  return wip.child;
}

/**
 * 对比子节点的current fiberNode 和 子节点的ReactElement 生成对应的子节点的fiberNode
 * @param {FiberNode} wip
 * @param {ReactElementType} children
 */
function reconcileChildren(wip: FiberNode, children?: ReactElementType) {
  const current = wip.alternate;
  if (current !== null) {
    // update
    wip.child = reconcileChildFibers(wip, current?.child, children);
  } else {
    // mount
    wip.child = mountChildFibers(wip, null, children);
  }
}

/**
 * 标记Ref
 */
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref;
  // mount时 有ref 或者 update时 ref变化
  if (
    (current === null && ref !== null) ||
    (current !== null && current.ref !== ref)
  ) {
    workInProgress.flags |= Ref;
  }
}
