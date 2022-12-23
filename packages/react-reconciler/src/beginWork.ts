import { FiberNode } from "./fiber";
import { HostComponent, HostRoot, HostText } from "./workTags";
import { processUpdateQueue, UpdateQueue } from "./updateQueue";
import { ElementType, ReactElementType } from "shared/ReactTypes";
import { reconcilerChildFibers } from "./childFibers";

/**
 * 递归中的递阶段
 * 比较 然后返回子fiberNode 或者null
 */
export const beginWork = (wip: FiberNode) => {
  switch (wip.tag) {
    case HostRoot:
      return updateHostRoot(wip);
    case HostComponent:
      return updateHostComponent(wip);
    case HostText:
      // 文本节点没有子节点，所以没有流程
      return null;
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
function updateHostRoot(wip: FiberNode) {
  const baseState = wip.memoizedState;
  const updateQueue = wip.updateQueue as UpdateQueue<ElementType>;
  // 这里是计算最新值
  const pending = updateQueue.shared.pending;
  updateQueue.shared.pending = null;
  const { memoizedState } = processUpdateQueue(baseState, pending); // 最新状态
  wip.memoizedState = memoizedState; // 其实就是传入的element

  const nextChildren = wip.memoizedState; // 子对应的ReactElement
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
    wip.child = reconcilerChildFibers(wip, current?.child, children);
  } else {
    // mount
    wip.child = reconcilerChildFibers(wip, null, children);
  }
}
