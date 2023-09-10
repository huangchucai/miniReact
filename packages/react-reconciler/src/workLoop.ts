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
  getNextLane,
  Lane,
  lanesToSchedulerPriority,
  markRootFinished,
  markRootSuspended,
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
import { getSuspenseThenable, SuspenseException } from "./thenable";
import { resetHookOnWind } from "./fiberHooks";
import { throwException } from "./fiberThrow";
import { unwindWork } from "./fiberUnwindWork";

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects: Boolean = false;

// 当前运行的状态
type RootExitStatus = number;

// 工作中的状态（1. 并发更新被打断 2. suspense被打断
const RootInProgress = 0;
// 并发更新  中途打断
const RootInComplete = 1; // 未执行完
// render完成
const RootCompleted = 2; // 执行完
// 由于挂起，当前是未完成状态，不用进入commit阶段
const RootDidNotComplete = 3;
let wipRootExitStatus: number = RootInProgress; // 工作的状态

type SuspendedReason = typeof NotSuspended | typeof SuspendedOnData;
const NotSuspended = 0;
const SuspendedOnData = 1;
let wipSuspendedReason: SuspendedReason = NotSuspended;

// 保存我们抛出的数据
let wipThrowValue: any = null;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  root.finishedLane = NoLane;
  root.finishedWork = null;
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;

  // 重置suspensed的状态
  wipSuspendedReason = NotSuspended;
  wipThrowValue = null;
  wipRootExitStatus = RootInProgress;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // fiberRootNode
  let root = markUpdateLaneFromFiberToRoot(fiber, lane);
  markRootUpdated(root, lane);
  ensureRootIsScheduled(root);
}

/**
 * schedule调度阶段入口
 */
export function ensureRootIsScheduled(root: FiberRootNode) {
  let updateLane = getNextLane(root);
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
export function markRootUpdated(root: FiberRootNode, lane: Lane) {
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}

// root.pendingLanes -> 整个组件树下的fiber中存在更新的lane合集
// fiberNode.lanes -> 单个fiber中update对应的lane合集
// 从当前触发更新的fiber向上遍历到根节点fiber
function markUpdateLaneFromFiberToRoot(fiber: FiberNode, lane: Lane) {
  let node = fiber;
  let parent = node.return;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    const alternate = parent.alternate;
    if (alternate !== null) {
      alternate.childLanes = mergeLanes(alternate.childLanes, lane);
    }
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

  const lane = getNextLane(root);
  const curCallbackNode = root.callbackNode;
  // 防御性编程
  if (lane === NoLane) {
    return null;
  }

  const needSync = lane === SyncLane || didTimeout;
  console.log("-hcc-didTimeout--", didTimeout);

  // render阶段
  // exitStatus 退出的状态
  const exitStatus = renderRoot(root, lane, !needSync);

  // 再次执行调度，用于判断之后root.callbackNode === curCallbackNode,
  // 因为如果并发过程中，优先级没有变，在执行调度后，由于curPriority === prevPriority，直接返回，导致curCallbackNode相等，继续调度
  // 如果有更高优先级的调度的话，本次调度直接返回null,停止调度
  ensureRootIsScheduled(root);

  switch (exitStatus) {
    // 中断
    case RootInComplete:
      // ensureRootIsScheduled中有更高的优先级插入进来, 停止之前的调度
      if (root.callbackNode !== curCallbackNode) {
        return null;
      }
      console.log("-hcc-中断--", didTimeout);
      // 继续调度
      return performConcurrentWorkOnRoot.bind(null, root);
    // 已经更新完
    case RootCompleted:
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = lane;
      wipRootRenderLane = NoLane;
      commitRoot(root);
      break;
    case RootDidNotComplete:
      wipRootRenderLane = NoLane;
      markRootSuspended(root, lane);
      ensureRootIsScheduled(root);
      break;
    default:
      console.error("还未实现的并发更新结束状态");
      break;
  }
}

/**
 * 同步更新入口(render入口)
 * @param {FiberRootNode} root
 */
function performSyncWorkOnRoot(root: FiberRootNode) {
  let nextLane = getNextLane(root);
  // 同步批处理中断的条件
  if (nextLane !== SyncLane) {
    // 其他比SyncLane 低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }
  let exitStatus = renderRoot(root, nextLane, false);
  switch (exitStatus) {
    case RootCompleted:
      const finishedWork = root.current.alternate;
      root.finishedWork = finishedWork;
      root.finishedLane = nextLane;
      wipRootRenderLane = NoLane;
      // wip fiberNode树  树中的flags执行对应的操作
      commitRoot(root);
      break;
    case RootDidNotComplete:
      wipRootRenderLane = NoLane;
      markRootSuspended(root, nextLane);
      ensureRootIsScheduled(root);
      break;
    default:
      if (__DEV__) {
        console.error("还未实现的同步更新结束状态");
      }
      break;
  }
}

let c = 0;

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
      if (wipSuspendedReason !== NotSuspended && workInProgress !== null) {
        // 有错误，进入unwind流程
        const throwValue = wipThrowValue;
        wipSuspendedReason = NotSuspended;
        wipThrowValue = null;
        // unwind操作
        throwAndUnwindWorkLoop(root, workInProgress, throwValue, lane);
      }

      shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("workLoop发生错误", e);
      }
      c++;
      if (c > 20) {
        console.warn("~~~~warn~~~~~!!!!!!!! 错误");
        break;
      }
      // workInProgress = null;
      handleThrow(root, e);
    }
  } while (true);

  if (wipRootExitStatus !== RootInProgress) {
    return wipRootExitStatus;
  }

  // 中断执行
  if (shouldTimeSlice && workInProgress !== null) {
    return RootInComplete;
  }
  if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
    console.error(`render阶段结束时wip不应该为null`);
  }

  //render阶段执行完
  return RootCompleted;
}

/**
 * unWind流程的具体操作
 * @param root
 * @param unitOfWork  当前的fiberNode(抛出错误的位置）
 * @param thrownValue 请求的promise
 * @param lane
 */
function throwAndUnwindWorkLoop(
  root: FiberRootNode,
  unitOfWork: FiberNode,
  thrownValue: any,
  lane: Lane
) {
  // 重置FC 的全局变量
  resetHookOnWind();
  // 请求返回后重新触发更新
  throwException(root, thrownValue, lane);
  // unwind
  unwindUnitOfWork(unitOfWork);
}

/**
 * 一直向上查找，找到距离它最近的Suspense fiberNode
 * @param unitOfWork
 */
function unwindUnitOfWork(unitOfWork: FiberNode) {
  let incompleteWork: FiberNode | null = unitOfWork;

  // 查找最近的suspense
  do {
    const next = unwindWork(incompleteWork);
    if (next !== null) {
      workInProgress = next;
      return;
    }

    const returnFiber = incompleteWork.return as FiberNode;
    if (returnFiber !== null) {
      returnFiber.deletions = null;
    }
    incompleteWork = returnFiber;
  } while (incompleteWork !== null);

  // 使用了use 但是没有定义suspense -> 到了root
  wipRootExitStatus = RootDidNotComplete;
  workInProgress = null;
}

function handleThrow(root: FiberRootNode, throwValue: any) {
  // Error  Boundary
  if (throwValue === SuspenseException) {
    throwValue = getSuspenseThenable();
    wipSuspendedReason = SuspendedOnData;
  }
  wipThrowValue = throwValue;
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
