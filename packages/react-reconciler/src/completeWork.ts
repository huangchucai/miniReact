import { FiberNode } from "./fiber";
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
import {
  appendInitialChild,
  Container,
  createInstance,
  createTextInstance,
} from "hostConfig";
import { NoFlags, Ref, Update, Visibility } from "./fiberFlags";
import { popProvider } from "./fiberContext";
import { popSuspenseHandler } from "./suspenseContext";
import { mergeLanes, NoLanes } from "./fiberLanes";

function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
}

function markRef(fiber: FiberNode) {
  fiber.flags |= Ref;
}

/**
 * 递归中的归
 */
export const completeWork = (wip: FiberNode) => {
  const newProps = wip.pendingProps;
  const current = wip.alternate;

  switch (wip.tag) {
    case HostComponent:
      if (current !== null && wip.stateNode) {
        // todo: update
        // 1. props是否变化  {onClick: xx} {onClick: xxx}
        // 2. 变了就需要标记 update flag
        // className style
        markUpdate(wip);
        // 标记ref
        if (current.ref !== wip.ref) {
          markRef(wip);
        }
      } else {
        // 1. 构建DOM
        const instance = createInstance(wip.type, newProps);
        // 2. 将DOM插入到DOM树中
        appendAllChildren(instance, wip);
        // 标记Ref
        if (wip.ref !== null) {
          markRef(wip);
        }
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostText:
      if (current !== null && wip.stateNode) {
        //update
        const oldText = current.memoizedProps.content;
        const newText = newProps.content;
        if (oldText !== newText) {
          // 标记更新
          markUpdate(wip);
        }
      } else {
        // 1. 构建DOM
        const instance = createTextInstance(newProps.content);
        // 2. 将DOM插入到DOM树中
        wip.stateNode = instance;
      }
      bubbleProperties(wip);
      return null;
    case HostRoot:
    case FunctionComponent:
    case Fragment:
    case OffscreenComponent:
      bubbleProperties(wip);
      return null;
    case ContextProvider:
      const context = wip.type._context;
      popProvider(context);
      bubbleProperties(wip);
      return null;
    case SuspenseComponent:
      /**
       * 对比Offscreen的mode(hide/visibity) 需要再suspense中
       * 因为如果在OffscreenComponent中比较的话，当在Fragment分支的时候
       * completeWork并不会走到OffscreenComponent
       *
       * current Offscreen mode 和 wip Offscreen mode 的对比
       */
      popSuspenseHandler();
      // 比较变化mode的变化（visible | hide）
      const offscreenFiber = wip.child as FiberNode;
      const isHidden = offscreenFiber.pendingProps.mode === "hidden";
      const currentOffscreenFiber = offscreenFiber.alternate;

      if (currentOffscreenFiber !== null) {
        // update
        const wasHidden = currentOffscreenFiber.pendingProps.mode === "hidden";
        if (wasHidden !== isHidden) {
          // 可见性发生了变化
          offscreenFiber.flags |= Visibility;
          bubbleProperties(offscreenFiber);
        }
      } else if (isHidden) {
        // mount 并且 hidden的状态 todo: 这里什么流程走到
        offscreenFiber.flags |= Visibility;
        bubbleProperties(offscreenFiber);
      }
      bubbleProperties(wip);
      return null;
    default:
      if (__DEV__) {
        console.warn("未实现的completeWork");
      }
      break;
  }
};

/**
 * 在parent的节点下，插入wip
 * 难点： 是fiber对应的节点和Dom树不对应
 *
 * function A () {
 *   return <div>11</div>
 * }
 *
 * <p><A /> <p/>  -> 对应的Dom 是A组件的子元素 <p><div>11</div></p>
 * @param {FiberNode} parent
 * @param {FiberNode} wip
 */
function appendAllChildren(parent: Container, wip: FiberNode) {
  let node = wip.child;

  while (node !== null) {
    if (node?.tag === HostComponent || node?.tag === HostText) {
      appendInitialChild(parent, node?.stateNode);
    } else if (node.child !== null) {
      node.child.return = node;
      // 继续向下查找
      node = node.child;
      continue;
    }

    if (node === wip) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === wip) {
        return;
      }
      // 向上找
      node = node?.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function bubbleProperties(wip: FiberNode) {
  let subtreeFlags = NoFlags;
  let child = wip.child;
  let newChildLanes = NoLanes;

  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;

    // child.lanes child.childLanes
    newChildLanes = mergeLanes(
      newChildLanes,
      mergeLanes(child.lanes, child.childLanes)
    );
    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
  wip.childLanes = newChildLanes;
}
