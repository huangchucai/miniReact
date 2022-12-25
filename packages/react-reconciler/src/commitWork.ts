import { FiberNode, FiberRootNode } from "./fiber";
import { MutationMask, NoFlags, Placement } from "./fiberFlags";
import { HostComponent, HostRoot, HostText } from "./workTags";
import { appendChildToContainer, Container } from "hostConfig";

let nextEffect: FiberNode | null = null;
export const commitMutationEffects = (finishedWork: FiberNode) => {
  nextEffect = finishedWork;

  while (nextEffect !== null) {
    const child: FiberNode | null = nextEffect.child;
    // 向下遍历
    if (
      (nextEffect.subtreeFlags & MutationMask) !== NoFlags &&
      child !== null
    ) {
      nextEffect = child;
    } else {
      // 向上遍历 DFS
      up: while (nextEffect !== null) {
        commitMutationEffectsOnFibers(nextEffect);
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

const commitMutationEffectsOnFibers = (finishedWork: FiberNode) => {
  const flags = finishedWork.flags;

  if ((flags & Placement) !== NoFlags) {
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;
  }
  // flags update
  // flags childDeletion
};

const commitPlacement = (finishWork: FiberNode) => {
  if (__DEV__) {
    console.warn("执行commitPlacement操作", finishWork);
  }
  // parentDom 插入 finishWork对应的dom

  // 1. 找到parentDom
  const hostParent = getHostParent(finishWork);
  appendPlacementNodeIntoContainer(finishWork, hostParent);
};

function getHostParent(fiber: FiberNode) {
  let parent = fiber.return;
  while (parent) {
    const parentTag = parent.tag;
    // HostComponent  HostRoot
    if (parentTag === HostComponent) {
      return parent.stateNode as Container;
    }
    if (parentTag === HostRoot) {
      return (parent.stateNode as FiberRootNode).current;
    }
    parent = parent.return;
  }
  if (__DEV__) {
    console.warn("未找到HostParent");
  }
}

function appendPlacementNodeIntoContainer(
  finishedWork: FiberNode,
  hostParent: Container
) {
  // fiber Host
  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    appendChildToContainer(finishedWork.stateNode, hostParent);
    return;
  }

  const child = finishedWork.child;
  if (child !== null) {
    appendPlacementNodeIntoContainer(child, hostParent);

    let sibling = child.sibling;

    while (sibling !== null) {
      appendPlacementNodeIntoContainer(sibling, hostParent);
      sibling = sibling.sibling;
    }
  }
}
