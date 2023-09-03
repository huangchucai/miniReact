import { FiberNode, FiberRootNode, PendingPassiveEffects } from "./fiber";
import {
  ChildDeletion,
  Flags,
  LayoutMask,
  MutationMask,
  NoFlags,
  PassiveEffect,
  PassiveMask,
  Placement,
  Ref,
  Update,
  Visibility,
} from "./fiberFlags";
import {
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  OffscreenComponent,
} from "./workTags";
import {
  appendChildToContainer,
  commitUpdate,
  Container,
  hideInstance,
  hideTextInstance,
  insertChildToContainer,
  Instance,
  removeChild,
  unhideInstance,
  unhideTextInstance,
} from "hostConfig";
import { Effect, FCUpdateQueue } from "./fiberHooks";
import { HookHasEffect } from "./hookEffectTags";

let nextEffect: FiberNode | null = null;

/**
 * commit副作用入口 DFS形式
 */
const commitEffects = (
  phrase: "mutation" | "layout",
  mask: Flags,
  callback: (fiber: FiberNode, root: FiberRootNode) => void
) => {
  return (finishedWork: FiberNode, root: FiberRootNode) => {
    nextEffect = finishedWork;

    while (nextEffect !== null) {
      const child: FiberNode | null = nextEffect.child;
      // 向下遍历
      if ((nextEffect.subtreeFlags & mask) !== NoFlags && child !== null) {
        nextEffect = child;
      } else {
        // 向上遍历 DFS
        up: while (nextEffect !== null) {
          callback(nextEffect, root);
          const sibling: FiberNode | null = nextEffect.sibling;
          if (sibling !== null) {
            nextEffect = sibling;
            break up;
          }
          nextEffect = nextEffect.return;
        }
      }
    }
  };
};

const commitMutationEffectsOnFibers = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const { flags, tag } = finishedWork;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  // flags update
  if ((flags & Update) !== NoFlags) {
    commitUpdate(finishedWork);
    finishedWork.flags &= ~Update;
  }
  // flags childDeletion
  if ((flags & ChildDeletion) !== NoFlags) {
    const deletions = finishedWork.deletions;
    if (deletions !== null) {
      deletions.forEach((childToDelete) => {
        commitDeletion(childToDelete, root);
      });
    }
    finishedWork.flags &= ~ChildDeletion;
  }

  if ((flags & PassiveEffect) !== NoFlags) {
    // 收集回调
    commitPassiveEffect(finishedWork, root, "update");
    finishedWork.flags &= ~PassiveEffect;
  }

  // 解绑之前的Ref
  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    safelyDetachRef(finishedWork);
  }

  // OffscreenComponent的mode的变动
  if ((flags & Visibility) !== NoFlags && tag === OffscreenComponent) {
    const isHidden = finishedWork.pendingProps.mode === "hidden";
    // 处理suspense 的offscreen
    hideOrUnhideAllChildren(finishedWork, isHidden);
    finishedWork.flags &= ~Visibility;
  }
};

/*
* OffscreenComponent中的子host 处理，可能是一个或者多个
* function Cpn() {
  return (
    <p>123</p>
  )
}

情况1，一个host节点：
<Suspense fallback={<div>loading...</div>}>
    <Cpn/>
</Suspense>

情况2，多个host节点：
<Suspense fallback={<div>loading...</div>}>
    <Cpn/>
    <div>
        <p>你好</p>
    </div>
</Suspense>
* */
function hideOrUnhideAllChildren(finishedWork: FiberNode, isHidden: boolean) {
  //1. 找到所有子树的顶层host节点
  findHostSubtreeRoot(finishedWork, (hostRoot) => {
    //2. 标记隐藏或者展示
    const instance = hostRoot.stateNode;
    if (hostRoot.tag === HostComponent) {
      isHidden ? hideInstance(instance) : unhideInstance(instance);
    } else if (hostRoot.tag === HostText) {
      isHidden
        ? hideTextInstance(instance)
        : unhideTextInstance(instance, hostRoot.memoizedProps.content);
    }
  });
}

function findHostSubtreeRoot(
  finishedWork: FiberNode,
  callback: (hostSubtreeRoot: FiberNode) => void
) {
  let node = finishedWork;
  let hostSubtreeRoot = null; // 子树顶层的host节点

  while (true) {
    if (node.tag === HostComponent) {
      if (hostSubtreeRoot === null) {
        hostSubtreeRoot = node;
        callback(node);
      }
    } else if (node.tag === HostRoot) {
      if (hostSubtreeRoot === null) {
        callback(node);
      }
    } else if (
      node.tag === OffscreenComponent &&
      node.pendingProps.mode === "hidden" &&
      node !== finishedWork
    ) {
      // 内嵌suspense, 什么都不需要单独做，嵌套内部就处理
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === finishedWork) {
      return;
    }

    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return;
      }
      if (hostSubtreeRoot === node) {
        hostSubtreeRoot = null;
      }
      node = node.return;
    }

    if (hostSubtreeRoot === node) {
      hostSubtreeRoot = null;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

/**
 *  解绑当前的ref
 */
function safelyDetachRef(current: FiberNode) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === "function") {
      ref(null);
    } else {
      ref.current = null;
    }
  }
}

/**
 * commit副作用入口 DFS形式
 * @param finishedWork
 */
export const commitMutationEffects = commitEffects(
  "mutation",
  MutationMask | PassiveMask,
  commitMutationEffectsOnFibers
);

/**
 * layout阶段
 * @param fiber
 * @param root
 * @param type
 */
const commitLayoutEffectsOnFibers = (
  finishedWork: FiberNode,
  root: FiberRootNode
) => {
  const { flags, tag } = finishedWork;

  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 绑定新的ref
    safelyAttachRef(finishedWork);
  }
};

export const commitLayoutEffects = commitEffects(
  "layout",
  LayoutMask,
  commitLayoutEffectsOnFibers
);

function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref;
  if (ref !== null) {
    const instance = fiber.stateNode;
    if (typeof ref === "function") {
      ref(instance);
    } else {
      ref.current = instance;
    }
  }
}

function commitPassiveEffect(
  fiber: FiberNode,
  root: FiberRootNode,
  type: keyof PendingPassiveEffects
) {
  //update unmount
  if (
    fiber.tag !== FunctionComponent ||
    (type === "update" && (fiber.flags & PassiveEffect) === NoFlags)
  ) {
    return;
  }
  const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;
  if (updateQueue !== null) {
    if (updateQueue.lastEffect === null && __DEV__) {
      console.error("当FC存在PassiveEffect flags时，不应该不存在effect");
    }
    root.pendingPassiveEffects[type].push(updateQueue.lastEffect as Effect);
  }
}

function commitHookEffectList(
  flags: Flags,
  lastEffect: Effect,
  callback: (effect: Effect) => void
) {
  let effect = lastEffect.next as Effect;
  do {
    if ((effect.tag & flags) === flags) {
      callback(effect);
    }
    effect = effect.next as Effect;
  } while (effect !== lastEffect.next);
}

export function commitHookEffectListUnmount(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
    effect.tag &= ~HookHasEffect;
  });
}

export function commitHookEffectListDestroy(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const destroy = effect.destroy;
    if (typeof destroy === "function") {
      destroy();
    }
  });
}

export function commitHookEffectListCreate(flags: Flags, lastEffect: Effect) {
  commitHookEffectList(flags, lastEffect, (effect) => {
    const create = effect.create;
    if (typeof create === "function") {
      effect.destroy = create();
    }
  });
}

/**
 * 记录要删除的子节点
 * @param childrenToDelete
 * @param unmountFiber
 */
function recordHostChildrenToDelete(
  childrenToDelete: FiberNode[],
  unmountFiber: FiberNode
) {
  // 1. 找到第一个root host 节点
  const lastOne = childrenToDelete[childrenToDelete.length - 1];
  if (!lastOne) {
    childrenToDelete.push(unmountFiber);
  } else {
    // 2. 每找到一个 host节点，判断下这个节点是不是 第一个的兄弟节点
    let node = lastOne.sibling;
    while (node !== null) {
      if (unmountFiber === node) {
        childrenToDelete.push(unmountFiber);
      }
      node = node.sibling;
    }
  }
}

/**
 * 删除对应的子fiberNode
 * @param {FiberNode} childToDelete
 */
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];
  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        safelyDetachRef(unmountFiber);
        return;
      case HostText:
        recordHostChildrenToDelete(rootChildrenToDelete, unmountFiber);
        return;
      case FunctionComponent:
        commitPassiveEffect(unmountFiber, root, "unmount");
        return;
      default:
        if (__DEV__) {
          console.warn("未处理的unmount类型", unmountFiber);
        }
        break;
    }
  });
  // 移除rootHostNode的DOM
  if (rootChildrenToDelete.length) {
    const hostParent = getHostParent(childToDelete);
    if (hostParent !== null) {
      rootChildrenToDelete.forEach((node) => {
        removeChild(node.stateNode, hostParent);
      });
    }
  }
  childToDelete.return = null;
  childToDelete.child = null;
}

function commitNestedComponent(
  root: FiberNode,
  onCommitUnmount: (fiber: FiberNode) => void
) {
  let node = root;
  while (true) {
    onCommitUnmount(node);

    if (node.child !== null) {
      // 向下遍历
      node.child.return = node;
      node = node.child;
      continue;
    }

    if (node === root) {
      // 终止条件
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      // 向上归
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

const commitPlacement = (finishWork: FiberNode) => {
  if (__DEV__) {
    console.warn("执行commitPlacement操作", finishWork);
  }
  // parentDom 插入 finishWork对应的dom

  // 1. 找到parentDom
  const hostParent = getHostParent(finishWork);

  // host sibling
  const sibling = getHostSibling(finishWork);

  if (hostParent !== null) {
    insertOrAppendPlacementNodeIntoContainer(finishWork, hostParent, sibling);
  }
};

/**
 * 获取相邻的真正的dom节点
 */
function getHostSibling(fiber: FiberNode) {
  let node: FiberNode = fiber;

  findSibling: while (true) {
    // 向上遍历
    while (node.sibling === null) {
      const parent = node.return;
      if (
        parent === null ||
        parent.tag === HostComponent ||
        parent.tag === HostRoot
      ) {
        return null;
      }
      node = parent;
    }

    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostText && node.tag !== HostComponent) {
      // 向下遍历，找到稳定（noFlags）的div或文本节点
      if ((node.flags & Placement) !== NoFlags) {
        // 节点不稳定
        continue findSibling;
      }

      if (node.child === null) {
        continue findSibling;
      } else {
        // 向下遍历
        node.child.return = node;
        node = node.child;
      }
    }

    if ((node.flags & Placement) === NoFlags) {
      return node.stateNode;
    }
  }
}

function getHostParent(fiber: FiberNode): Container | null {
  let parent = fiber.return;
  while (parent) {
    const parentTag = parent.tag;
    // HostComponent  HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).container;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn("未找到HostParent");
  }
  return null;
}

function insertOrAppendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container,
  before?: Instance
) {
  // fiber Host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    if (before) {
      insertChildToContainer(finishedWork.stateNode, hostParent, before);
    } else {
      appendChildToContainer(hostParent, finishedWork.stateNode);
    }
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    insertOrAppendPlacementNodeIntoContainer(child, hostParent);

    let sibling = child.sibling;

    while (sibling !== null) {
      insertOrAppendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
  return null;
}
