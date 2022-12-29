import { FunctionComponent, HostComponent, WorkTag } from "./workTags";
import { Key, Props, ReactElementType, Ref } from "shared/ReactTypes";
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";

export class FiberNode {
  tag: WorkTag;
  pendingProps: Props;
  key: Key;
  stateNode: any;
  type: any;
  return: FiberNode | null;
  sibling: FiberNode | null;
  child: FiberNode | null;
  index: number;
  ref: Ref;
  memoizedProps: Props | null;
  memoizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.pendingProps = pendingProps;
    this.key = key;
    this.stateNode = null; // dom引用
    this.type = null; // 组件本身  FunctionComponent () => {}

    // 树状结构
    this.return = null; // 指向父fiberNode
    this.sibling = null; // 兄弟节点
    this.child = null; // 子节点
    this.index = 0; // 兄弟节点的索引

    this.ref = null;

    // 工作单元
    this.pendingProps = pendingProps; // 等待更新的属性
    this.memoizedProps = null; // 正在工作的属性
    this.memoizedState = null;
    this.updateQueue = null;

    this.alternate = null; // 双缓存树指向(workInProgress 和 current切换）
    this.flags = NoFlags; // 副作用标识
    this.subtreeFlags = NoFlags; // 子树中的副作用
  }
}

/**
 * 顶部节点
 */
export class FiberRootNode {
  container: Container; // 不同环境的不同的节点 在浏览器环境 就是 root节点
  current: FiberNode;
  finishedWork: FiberNode | null; // 递归完成后的hostRootFiber
  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null; // 最后完成的fiberNode树
  }
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;

  if (wip === null) {
    //mount
    wip = new FiberNode(current.tag, pendingProps, current.key);
    wip.stateNode = current.stateNode;

    wip.alternate = current;
    current.alternate = wip;
  } else {
    //update
    wip.pendingProps = pendingProps;
    // 清掉副作用（上一次更新遗留下来的）
    wip.flags = NoFlags;
    wip.subtreeFlags = NoFlags;
  }

  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;
  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props } = element;
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === "string") {
    // <div/>  type : 'div'
    fiberTag = HostComponent;
  } else if (typeof type !== "function" && __DEV__) {
    console.log("未定义的type类型", element);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  return fiber;
}
