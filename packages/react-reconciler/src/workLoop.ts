/* eslint-disable */
/**
 * 工作循环的文件
 * @每一个fiber都是
 * 1. 如果有子节点，遍历子节点  2、 没有子节点就遍历兄弟节点
 * 2. 每一个fiber都是先beginWork 然后completeWork
 */
import {
  createWorkInProgress,
  FiberNode,
  FiberRootNode,
  PendingPassiveEffects,
} from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { HostRoot } from "./workTags";
import { MutationMask, NoFlags, PassiveMask } from "./fiberFlags";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitLayoutEffects,
  commitMutationEffects,
} from "./commitWork";
import {
  getHighestPriorityLane,
  Lane,
  lanesToSchedulerPriority,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { scheduleMicroTask } from "hostConfig";
import {
  unstable_cancelCallback,
  unstable_NormalPriority as NormalPriority,
  unstable_scheduleCallback as scheduleCallback,
  unstable_shouldYield,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects: Boolean = false;

// 当前运行的状态
type RootExitStatus = number;
const RootInComplete = 1; // 未执行完
const RootCompleted = 2; // 执行完
// todo: 执行过程报错

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // fiberRootNode
  let root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

/**
 * schedule调度阶段入口
 */
function ensureRootIsScheduled(root: FiberRootNode) {
  let updateLane = getHighestPriorityLane(root.pendingLanes);
  // 获取当前的callback
  const existingCallback = root.callbackNode;

  if (updateLane === NoLane) {
    if (existingCallback !== null) {
      unstable_cancelCallback(existingCallback);
    }
    root.callbackNode = null;
    root.callbackPriority = NoLane;
    return;
  }

  const curPriority = updateLane;
  const prevPriority = root.callbackPriority;
  if (curPriority === prevPriority) {
    // 如果之前的优先级等于当前的优先级, 不需要重新的调度，scheduler会自动的获取performConcurrentWorkOnRoot的返回函数继续调度
    // （return performConcurrentWorkOnRoot.bind(null, root); 中继续调度）
    return;
  }

  // 当前产生了更高优先级调度，取消之前的调度
  if (existingCallback !== null) {
    unstable_cancelCallback(existingCallback);
  }

  let newCallbackNode = null;
  if (__DEV__) {
    console.log(
      `-hcc-在${updateLane === SyncLane ? "微" : "宏"} 任务中调度，优先级：`,
      updateLane
    );
  }

  if (updateLane === SyncLane) {
    // 同步优先级  用微任务调度

    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 用宏任务调度

    // 将react-lane 转换成 调度器的优先级
    const schedulerPriority = lanesToSchedulerPriority(updateLane);
    newCallbackNode = scheduleCallback(
      schedulerPriority,
      // @ts-ignore
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
  // 保存当前的调度任务以及调度任务的优先级
  root.callbackNode = newCallbackNode;
  root.callbackPriority = curPriority;
}

/**
 * 处理rootNode的lanes
 */
function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// 从当前触发更新的fiber向上遍历到根节点fiber
function markUpdateFromFiberToRoot(fiber: FiberNode) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    node = parent;
    parent = node.return;
  }
  if (node.tag === HostRoot) {
    return node.stateNode;
  }
  return null;
}

/**
 * 并发更新的render入口 -> scheduler时间切片执行的函数
 * @didTimeout: 调度器传入 -> 任务是否过期
 */
function performConcurrentWorkOnRoot(
  root: FiberRootNode,
  didTimeout: boolean
): any {
  // 并发开始的时候，需要保证useEffect回调已经执行
  // 因为useEffect的执行会触发更新，可能产生更高优先级的更新。
  // function App() {
  //   useEffect(() => {
  //      updatexxx() // 如果触发了更高级别的更新
  //   }, [])
  // }
  const curCallback = root.callbackNode;
  let didFlushPassiveEffect = flushPassiveEffects(root.pendingPassiveEffects);
  if (didFlushPassiveEffect) {
    // 这里表示：useEffect执行，触发了更新，并产生了比当前的更新优先级更高的更新，取消本次的调度
    if (root.callbackNode !== curCallback) {
      return null;
    }
  }

  const lane = getHighestPriorityLane(root.pendingLanes);
  const curCallbackNode = root.callbackNode;
  // 防御性编程
  if (lane === NoLane) {
    return null;
  }

  const needSync = lane === SyncLane || didTimeout;
  console.log("-hcc-didTimeout--", didTimeout);

  // render阶段
  const exitStatus = renderRoot(root, lane, !needSync);

  // 再次执行调度，用于判断之后root.callbackNode === curCallbackNode,
  // 因为如果并发过程中，优先级没有变，在执行调度后，由于curPriority === prevPriority，直接返回，导致curCallbackNode相等，继续调度
  // 如果有更高优先级的调度的话，本次调度直接返回null,停止调度
  ensureRootIsScheduled(root);

  // 中断
  if (exitStatus === RootInComplete) {
    // ensureRootIsScheduled中有更高的优先级插入进来, 停止之前的调度
    if (root.callbackNode !== curCallbackNode) {
      return null;
    }
    console.log("-hcc-中断--", didTimeout);
    // 继续调度
    return performConcurrentWorkOnRoot.bind(null, root);
  }

  // 已经更新完
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = lane;
    wipRootRenderLane = NoLane;

    commitRoot(root);
  } else if (__DEV__) {
    console.error("还未实现的并发更新结束状态");
  }
}

/**
 * 同步更新入口(render入口)
 * @param {FiberRootNode} root
 */
function performSyncWorkOnRoot(root: FiberRootNode) {
  let nextLane = getHighestPriorityLane(root.pendingLanes);
  // 同步批处理中断的条件
  if (nextLane !== SyncLane) {
    // 其他比SyncLane 低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }
  let exitStatus = renderRoot(root, nextLane, false);
  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLane = nextLane;
    wipRootRenderLane = NoLane;

    // wip fiberNode树  树中的flags执行对应的操作
    commitRoot(root);
  } else if (__DEV__) {
    console.error("还未实现的同步更新结束状态");
  }
}

/**
 * 并发和同步更新的入口（render阶段）
 * @param root
 * @param lane
 * @param shouldTimeSlice
 */
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
  if (__DEV__) {
    console.log(`开始${shouldTimeSlice ? "并发" : "同步"}render更新`);
  }

  // 由于并发更新会不断的执行，但是并不需要更新，所以我们需要判断优先级看看是否需要初始化
  // 如果wipRootRenderLane 不等于 当前更新的lane， 就需要重新初始化，从根部开始调度
  if (wipRootRenderLane !== lane) {
    // 初始化，将workInProgress 指向第一个fiberNode
    prepareFreshStack(root, lane);
  }

  do {
    try {
      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("workLoop发生错误", e);
      }
      workInProgress = null;
    }
  } while (true);

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(`render阶段结束时wip不应该为null`);
  }
  // todo: 报错中断

  //render阶段执行完
  return RootCompleted;
}

function commitRoot(root: FiberRootNode) {
  const finishedWork = root.finishedWork;

  if (finishedWork === null) {
    return;
  }

  if (__DEV__) {
    console.warn("commit阶段开始", finishedWork);
  }
  const lane = root.finishedLane;

  if (lane === NoLane && __DEV__) {
    console.error("commit阶段finishedLane 不应该是NoLane");
  }
  // 重置
  root.finishedWork = null;
  root.finishedLane = NoLane;
  markRootFinished(root, lane);

  // 当前Fiber树中存在函数组件需要执行useEffect的回调
  if (
    (finishedWork.flags & PassiveMask) !== NoFlags ||
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags
  ) {
    // 防止多次调用
    if (!rootDoesHasPassiveEffects) {
      rootDoesHasPassiveEffects = true;
      // 调度副作用
      scheduleCallback(NormalPriority, () => {
        // 执行副作用
        flushPassiveEffects(root.pendingPassiveEffects);
        return;
      });
    }
  }

  // 判断是否存在子阶段需要执行的操作
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags; // 子节点是否有更新
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags; // 根节点是否更新

  if (subtreeHasEffect || rootHasEffect) {
    // 阶段1/3 beforeMutation

    // 阶段2/3 mutation Placement
    commitMutationEffects(finishedWork, root);

    // fiber Tree 切换
    root.current = finishedWork;

    //阶段3/3 layout
    commitLayoutEffects(finishedWork, root);
  } else {
    // fiber Tree 切换
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  let didFlushPassiveEffect = false;
  // unmount effect
  pendingPassiveEffects.unmount.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  pendingPassiveEffects.update.forEach((effect) => {
    didFlushPassiveEffect = true;
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });

  pendingPassiveEffects.update = [];
  flushSyncCallbacks();
  return didFlushPassiveEffect;
}

// 同步更新
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 并发更新
function workLoopConcurrent() {
  while (workInProgress !== null && !unstable_shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode): void {
  const next = beginWork(fiber, wipRootRenderLane); // next 是fiber的子fiber 或者 是null
  // 工作完成，需要将pendingProps 复制给 已经渲染的props
  fiber.memoizedProps = fiber.pendingProps;

  if (next === null) {
    // 没有子fiber
    completeUnitOfWork(fiber);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(fiber: FiberNode) {
  let node: FiberNode | null = fiber;
  do {
    completeWork(node);
    const sibling = node.sibling;
    if (sibling !== null) {
      workInProgress = sibling;
      return;
    }
    node = node.return;
    workInProgress = node;
  } while (node !== null);
}
