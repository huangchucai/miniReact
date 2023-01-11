import { FiberNode } from "./fiber";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
} from "./workTags";
import {
  appendInitialChild,
  Container,
  createInstance,
  createTextInstance,
} from "hostConfig";
import { NoFlags, Update } from "./fiberFlags";
import { updateFiberProps } from "../../react-dom/src/SyntheticEvent";
function markUpdate(fiber: FiberNode) {
  fiber.flags |= Update;
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
        //update
        // 1. props是否变化  {onClick: xx} {onClick: xxx}
        // 2. 变了就需要标记 update flag
        // className style
        updateFiberProps(wip.stateNode, newProps);
      } else {
        // 1. 构建DOM
        const instance = createInstance(wip.type, newProps);
        // 2. 将DOM插入到DOM树中
        appendAllChildren(instance, wip);
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
    case FunctionComponent:
      bubbleProperties(wip);
      return null;
    case HostRoot:
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
  while (child !== null) {
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;

    child.return = wip;
    child = child.sibling;
  }
  wip.subtreeFlags |= subtreeFlags;
}
