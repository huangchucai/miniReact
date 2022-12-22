/* eslint-disable */
/**
 * 工作循环的文件
 * @每一个fiber都是
 * 1. 如果有子节点，遍历子节点  2、 没有子节点就遍历兄弟节点
 * 2. 每一个fiber都是先beginWork 然后completeWork
 */
import { FiberNode } from "./fiber";
import { beginWork } from "./beginWork";
import { completeWork } from "./completeWork";

let workInProgress: FiberNode | null = null;

function prepareFreshStack(fiber: FiberNode) {
  workInProgress = fiber;
}

// @ts-ignore
function renderRoot(root: FiberNode) {
  // 初始化，将workInProgress 指向第一个fiberNode
  prepareFreshStack(root);
  do {
    try {
      workLoop();
      break;
    } catch (e) {
      console.warn("workLoop发生错误", e);
      workInProgress = null;
    }
  } while (true);
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
