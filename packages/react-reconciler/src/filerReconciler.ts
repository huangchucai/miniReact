import { Container } from "hostConfig";
import { FiberNode, FiberRootNode } from "./fiber";
import { HostRoot } from "./workTags";
import {
  createUpdate,
  createUpdateQueue,
  enqueueUpdate,
  UpdateQueue,
} from "./updateQueue";
import { ReactElementType } from "shared/ReactTypes";
import { scheduleUpdateOnFiber } from "./workLoop";
import { requestUpdateLane } from "./fiberLanes";
import {
  unstable_ImmediatePriority,
  unstable_runWithPriority,
} from "scheduler";

/**
 * ReactDOM.createRoot()中调用
 * 1. 创建fiberRootNode 和 hostRootFiber。并建立联系
 * @param {Container} container
 */
export function createContainer(container: Container) {
  const hostRootFiber = new FiberNode(HostRoot, {}, null);
  const fiberRootNode = new FiberRootNode(container, hostRootFiber);
  hostRootFiber.updateQueue = createUpdateQueue();
  return fiberRootNode;
}

/**
 * ReactDOM.createRoot().render 中调用更新
 * 1. 创建update, 并将其推到enqueueUpdate中
 */
export function updateContainer(
  element: ReactElementType | null,
  root: FiberRootNode
) {
  unstable_runWithPriority(unstable_ImmediatePriority, () => {
    const hostRootFiber = root.current;
    const lane = requestUpdateLane(); // 每一个更新设置一个lane(优先级）
    const update = createUpdate<ReactElementType | null>(element, lane);
    enqueueUpdate(
      // 首页渲染，直接插入更新
      hostRootFiber.updateQueue as UpdateQueue<ReactElementType | null>,
      update,
      hostRootFiber,
      lane
    );
    // 插入更新后，进入调度
    scheduleUpdateOnFiber(hostRootFiber, lane);
  });
  return element;
}
