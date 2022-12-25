/* eslint-disable */
/**
 * 工作循环的文件
 * @每一个fiber都是
 * 1. 如果有子节点，遍历子节点  2、 没有子节点就遍历兄弟节点
 * 2. 每一个fiber都是先beginWork 然后completeWork
 */
import { createWorkInProgress, FiberNode, FiberRootNode } from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";
import { HostRoot } from "./workTags";
import { MutationMask, NoFlags } from "./fiberFlags";
import { commitMutationEffects } from "./commitWork";

let workInProgress: FiberNode | null = null;

function prepareFreshStack(root: FiberRootNode) {
  workInProgress = createWorkInProgress(root.current, {});
}

export function scheduleUpdateOnFiber(fiber: FiberNode) {
  // todo 调度功能
  let root = markUpdateFromFiberToRoot(fiber);
  renderRoot(root);
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

function renderRoot(root: FiberRootNode) {
  // 初始化，将workInProgress 指向第一个fiberNode
  prepareFreshStack(root);
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
  // 重置
  root.finishedWork = null;

  // 判断是否存在3个子阶段需要执行的操作
  const subtreeHasEffect =
    (finishedWork.subtreeFlags & MutationMask) !== NoFlags; // 子节点是否有更新
  const rootHasEffect = (finishedWork.flags & MutationMask) !== NoFlags; // 根节点是否更新

  if (subtreeHasEffect || rootHasEffect) {
    // beforeMutation
    // mutation Placement
    commitMutationEffects(finishedWork);
    root.current = finishedWork;
    // layout
  } else {
    root.current = finishedWork;
  }
}

function workLoop() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(fiber: FiberNode): void {
  const next = beginWork(fiber); // next 是fiber的子fiber 或者 是null
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
