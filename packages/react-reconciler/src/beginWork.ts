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
import {
  cloneChildFibers,
  mountChildFibers,
  reconcileChildFibers,
} from "./childFibers";
import { bailOutHook, renderWithHooks } from "./fiberHooks";
import { includeSomeLanes, Lane, NoLanes } from "./fiberLanes";
import {
  ChildDeletion,
  DidCapture,
  NoFlags,
  Placement,
  Ref,
} from "./fiberFlags";
import { pushProvider } from "./fiberContext";
import { pushSuspenseHandler } from "./suspenseContext";

// 是否能命中bailout
let didReceiveUpdate = false; //(默认命中bailout策略,不接受更新）

export function markWipReceivedUpdate() {
  didReceiveUpdate = true; // 接受更新，没有命中bailout
}

/**
 * 递归中的递阶段
 * 比较 然后返回子fiberNode 或者null
 */
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  // 四要素 -> 判断是否变化 (props state context type)
  didReceiveUpdate = false;
  const current = wip.alternate;
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = wip.pendingProps;
    console.log("-hcc-beginWork", oldProps, newProps, wip);
    console.log("-hcc-beginWork-比较", oldProps === newProps);
    // props 和 type
    if (oldProps !== newProps || current.type !== wip.type) {
      didReceiveUpdate = true; // 不能命中bailout
    } else {
      console.warn("命中bailout --- 满足props 和 type");
      // state context比较
      const hasScheduledStateOrContext = checkScheduledUpdateOrContext(
        current,
        renderLane
      );
      if (!hasScheduledStateOrContext) {
        // 四要素中的 state / context 不变
        // 命中bailout
        didReceiveUpdate = false;

        // context的入栈、出栈
        switch (wip.tag) {
          case ContextProvider:
            const newValue = wip.memoizedProps.value;
            const context = wip.type._context;
            pushProvider(context, newValue);
            break;
          // TODO: Suspense
          default:
            break;
        }

        return bailoutOnAlreadyFinishedWork(wip, renderLane);
      }
    }
  }

  /**
   * beginWork消费update  update -> state
   */
  wip.lanes = NoLanes;

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
 * 复用上一次的结果，不进行本次更新
 * @param wip
 * @param renderLane
 */
function bailoutOnAlreadyFinishedWork(wip: FiberNode, renderLane: Lane) {
  // 1. 检查优化程度
  /**
   * 如果这个检查返回false，
   * 说明当前fiber的子节点不包含任何应该在当前render lane更新的内容。这种情况下，
   * 这个fiber subtree（该节点及其所有子节点）在当前渲染过程中可以被跳过（bailout），
   * 因为没有相关的更新需要应用于这部分的DOM。
   * 因此，通过返回null来中止当前fiber的工作。
   */
  if (!includeSomeLanes(wip.childLanes, renderLane)) {
    // 检查整个子树
    if (__DEV__) {
      console.warn("bailout整课子树", wip);
    }
    return null;
  }
  if (__DEV__) {
    console.warn("bailout一个fiber", wip);
  }

  cloneChildFibers(wip);
  return wip.child;
}

/**
 * renderLane 代表本次更新对应的优先级
 * updateLanes 代表当前fiber所有未执行的update对应的更新的优先级
 *
 * 所以这行代码的意思是： 当前这个fiber中所有未执行的update对应更新的优先级中是否包含了本次更新的优先级，也就是本次更新当前这个fiber是否有状态会变化
 * @param current
 * @param renderLane
 */
function checkScheduledUpdateOrContext(
  current: FiberNode,
  renderLane: Lane
): boolean {
  const updateLanes = current.lanes;

  if (includeSomeLanes(updateLanes, renderLane)) {
    // 本次更新存在的优先级，在当前的fiber中存在
    return true;
  }
  return false;
}

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

  const prevChildren = wip.memoizedState; // 计算前的值
  const { memoizedState } = processUpdateQueue(baseState, pending, renderLane); // 计算最新状态
  wip.memoizedState = memoizedState; // 其实就是传入的element

  const current = wip.alternate;
  if (current !== null) {
    if (!current.memoizedState) {
      current.memoizedState = memoizedState;
    }
  }

  const nextChildren = wip.memoizedState; // 子对应的ReactElement
  if (prevChildren === nextChildren) {
    // 没有变化
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }
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

  const current = wip.alternate;
  if (current !== null && !didReceiveUpdate) {
    // 命中bailout策略
    bailOutHook(wip, renderLane);
    return bailoutOnAlreadyFinishedWork(wip, renderLane);
  }
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
