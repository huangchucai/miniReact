import {
  createFiberFromElement,
  createWorkInProgress,
  FiberNode,
} from "./fiber";
import { Props, ReactElementType } from "shared/ReactTypes";
import { REACT_ELEMENT_TYPE } from "shared/ReactSymbols";
import { HostText } from "./workTags";
import { ChildDeletion, Placement } from "./fiberFlags";

export function ChildReconciler(shouldTrackEffects: boolean) {
  function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
    if (!shouldTrackEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      // 当前父fiber还没有需要删除的子fiber
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  /**
   * 根据reactElement对象创建fiber并返回
   * @param {FiberNode} returnFiber
   * @param {FiberNode | null} currentFiber
   * @param {ReactElementType} element
   */
  function reconcileSingleElement(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    element: ReactElementType
  ) {
    const key = element.key;
    // update的情况<单节点的处理 div -> p>
    if (currentFiber !== null) {
      // key相同
      if (currentFiber.key === key) {
        // 是react元素
        if (element.$$typeof === REACT_ELEMENT_TYPE) {
          // type相同
          if (currentFiber.type === element.type) {
            const existing = useFiber(currentFiber, element.props);
            existing.return = returnFiber;
            return existing;
          }
          // 删除旧的 （key相同，type不同）
          deleteChild(returnFiber, currentFiber);
        } else {
          if (__DEV__) {
            console.warn("还未实现的React类型", element);
          }
        }
      } else {
        // 删掉旧的，之后创建新的
        deleteChild(returnFiber, currentFiber);
      }
    }

    const fiber = createFiberFromElement(element);
    fiber.return = returnFiber;
    return fiber;
  }

  function reconcileSingleTextNode(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    content: string | number
  ): FiberNode {
    // update
    if (currentFiber !== null) {
      // 类型没有变，可以复用
      if (currentFiber.tag === HostText) {
        const existing = useFiber(currentFiber, { content });
        existing.return = returnFiber;
        return existing;
      }
      // 删掉之前的 （之前的div， 现在是hostText）
      deleteChild(returnFiber, currentFiber);
    }
    const fiber = new FiberNode(HostText, { content }, null);
    fiber.return = returnFiber;
    return fiber;
  }

  // 插入单一的节点
  function placeSingleChild(fiber: FiberNode) {
    if (shouldTrackEffects && fiber.alternate === null) {
      // 首屏渲染的情况
      fiber.flags |= Placement;
    }
    return fiber;
  }

  return function reconcilerChildFibers(
    returnFiber: FiberNode,
    currentFiber: FiberNode | null,
    newChild?: ReactElementType | string | number
  ) {
    // 判断当前fiber的类型
    if (typeof newChild === "object" && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFiber, newChild)
          );
        default:
          if (__DEV__) {
            console.warn("未实现的reconcile类型", newChild);
          }
          break;
      }
    }
    // Todo 多节点的情况 ul > li * 3

    // HostText
    if (typeof newChild === "string" || typeof newChild === "number") {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFiber, newChild)
      );
    }

    // 兜底操作
    if (currentFiber !== null) {
      deleteChild(returnFiber, currentFiber);
    }
    if (__DEV__) {
      console.warn("未实现的reconcile类型", newChild);
    }
    return null;
  };
}

/**
 * 双缓存树原理：基于当前的fiberNode创建一个新的fiberNode, 而不用去调用new FiberNode
 * @param {FiberNode} fiber
 * @param {Props} pendingProps
 * @returns {FiberNode}
 */
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
  const clone = createWorkInProgress(fiber, pendingProps);
  clone.index = 0;
  clone.sibling = null;
  return clone;
}

export const reconcilerChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
