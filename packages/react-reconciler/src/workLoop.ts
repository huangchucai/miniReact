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
import {
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
} from "./fiberFlags";
import {
  commitHookEffectListCreate,
  commitHookEffectListDestroy,
  commitHookEffectListUnmount,
  commitMutationEffects,
} from "./commitWork";
import {
  getHighestPriorityLane,
  Lane,
  markRootFinished,
  mergeLanes,
  NoLane,
  SyncLane,
} from "./fiberLanes";
import { flushSyncCallbacks, scheduleSyncCallback } from "./syncTaskQueue";
import { scheduleMicroTask } from "hostConfig";
import {
  unstable_scheduleCallback as scheduleCallback,
  unstable_NormalPriority as NormalPriority,
} from "scheduler";
import { HookHasEffect, Passive } from "./hookEffectTags";

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects: Boolean = false;

function prepareFreshStack(root: FiberRootNode, lane: Lane) {
  workInProgress = createWorkInProgress(root.current, {});
  wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
  // fiberRootNode
  let root = markUpdateFromFiberToRoot(fiber);
  markRootUpdated(root, lane);
  // renderRoot(root);
  ensureRootIsScheduled(root);
}

/**
 * 调度阶段入口
 */
function ensureRootIsScheduled(root: FiberRootNode) {
  let updateLane = getHighestPriorityLane(root.pendingLanes);
  if (updateLane === NoLane) {
    return;
  }
  if (updateLane === SyncLane) {
    // 同步优先级  用微任务调度
    if (__DEV__) {
      console.log("-hcc-在微任务中调度，优先级：", updateLane);
    }
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
    scheduleMicroTask(flushSyncCallbacks);
  } else {
    // 其他优先级 用宏任务调度
  }
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
 * 同步更新入口(render入口)
 * @param {FiberRootNode} root
 * @param lane
 */
function performSyncWorkOnRoot(root: FiberRootNode, lane: Lane) {
  let nextLane = getHighestPriorityLane(root.pendingLanes);
  if (nextLane !== SyncLane) {
    // 其他比SyncLane 低的优先级
    // NoLane
    ensureRootIsScheduled(root);
    return;
  }
  if (__DEV__) {
    console.warn("-hcc-render阶段开始");
  }
  // 初始化，将workInProgress 指向第一个fiberNode
  prepareFreshStack(root, lane);
  do {
    try {
      workLoop();
      break;
    } catch (e) {
      if (__DEV__) {
        console.warn("workLoop发生错误", e);
      }
      workInProgress = null;
    }
  } while (true);

  const finishedWork = root.current.alternate;
  root.finishedWork = finishedWork;
  root.finishedLane = lane;
  wipRootRenderLane = NoLane;

  // wip fiberNode树  树中的flags执行对应的操作
  commitRoot(root);
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
    // beforeMutation
    // mutation Placement
    commitMutationEffects(finishedWork, root);
    root.current = finishedWork;
    // layout
  } else {
    root.current = finishedWork;
  }

  rootDoesHasPassiveEffects = false;
  ensureRootIsScheduled(root);
}

function flushPassiveEffects(pendingPassiveEffects: PendingPassiveEffects) {
  // unmount effect
  pendingPassiveEffects.unmount.forEach((effect) => {
    commitHookEffectListUnmount(Passive, effect);
  });
  pendingPassiveEffects.unmount = [];

  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListDestroy(Passive | HookHasEffect, effect);
  });

  pendingPassiveEffects.update.forEach((effect) => {
    commitHookEffectListCreate(Passive | HookHasEffect, effect);
  });

  pendingPassiveEffects.update = [];
  flushSyncCallbacks();
}

function workLoop() {
  while (workInProgress !== null) {
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
