import {
  ContextProvider,
  Fragment,
  FunctionComponent,
  HostComponent,
  OffscreenComponent,
  SuspenseComponent,
  WorkTag,
} from "./workTags";
import { Key, Props, ReactElementType, Ref, Wakeable } from "shared/ReactTypes";
import { Flags, NoFlags } from "./fiberFlags";
import { Container } from "hostConfig";
import { Lane, Lanes, NoLane, NoLanes } from "./fiberLanes";
import { Effect } from "./fiberHooks";
import { CallbackNode } from "scheduler";
import { REACT_PROVIDER_TYPE, REACT_SUSPENSE_TYPE } from "shared/ReactSymbols";

export interface OffscreenProps {
  mode: "hidden" | "visible";
  children: any;
}

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
  ref: Ref | null;
  memoizedProps: Props | null;
  memoizedState: any;
  alternate: FiberNode | null;
  flags: Flags;
  subtreeFlags: Flags;
  updateQueue: unknown;
  deletions: FiberNode[] | null;

  constructor(tag: WorkTag, pendingProps: Props, key: Key) {
    this.tag = tag;
    this.pendingProps = pendingProps;
    this.key = key || null;
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
    this.memoizedState = null; // 指向hooks的链表
    this.updateQueue = null;

    this.alternate = null; // 双缓存树指向(workInProgress 和 current切换）

    // 副作用
    this.flags = NoFlags; // 副作用标识
    this.subtreeFlags = NoFlags; // 子树中的副作用
    this.deletions = null; // 保存需要删除的子fiberNode
  }
}

export interface PendingPassiveEffects {
  unmount: Effect[];
  update: Effect[];
}

/**
 * 顶部节点
 */
export class FiberRootNode {
  container: Container; // 不同环境的不同的节点 在浏览器环境 就是 root节点
  current: FiberNode;
  finishedWork: FiberNode | null; // 递归完成后的hostRootFiber
  pendingLanes: Lanes; // 所有未被消费的lane集合
  finishedLane: Lane; // 本次更新消费的lane
  pendingPassiveEffects: PendingPassiveEffects; //收集useEffect的回调

  // 调度器相关
  callbackNode: CallbackNode | null; // 保存调度器回调的函数
  callbackPriority: Lane;

  // WeakMap { promise: Set<Lane> }
  pingCache: WeakMap<Wakeable<any>, Set<Lane>> | null;

  // update -> suspended lane - suspendedLanes
  suspendedLanes: Lanes; // Root下所有被挂起的优先级

  // wakeable -> ping lane -> pingedLanes
  pingedLanes: Lanes; // Root下面挂起的任务被ping了的优先级

  constructor(container: Container, hostRootFiber: FiberNode) {
    this.container = container;
    this.current = hostRootFiber;
    hostRootFiber.stateNode = this;
    this.finishedWork = null; // 最后完成的fiberNode树
    this.pendingLanes = NoLanes;
    this.suspendedLanes = NoLanes;
    this.pingedLanes = NoLanes;

    this.finishedLane = NoLane;

    this.callbackNode = null;
    this.callbackPriority = NoLane;

    this.pendingPassiveEffects = {
      unmount: [],
      update: [],
    };

    this.pingCache = null;
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
    wip.deletions = null;
  }

  wip.type = current.type;
  wip.updateQueue = current.updateQueue;
  wip.child = current.child;

  // 数据
  wip.memoizedProps = current.memoizedProps;
  wip.memoizedState = current.memoizedState;
  wip.ref = current.ref;
  return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
  const { type, key, props, ref } = element;
  let fiberTag: WorkTag = FunctionComponent;

  if (typeof type === "string") {
    // <div/>  type : 'div'
    fiberTag = HostComponent;
  } else if (
    // <Context.Provider/>
    typeof type === "object" &&
    type.$$typeof === REACT_PROVIDER_TYPE
  ) {
    // <Context.Provider/>
    /**
     * {
     *   $$typeof: Symbol(react.element),
     *   props : { children, value }
     *   type: {$$typeof: Symbol(react.provider), _context: {xxx}}
     * }
     */
    fiberTag = ContextProvider;
  } else if (type === REACT_SUSPENSE_TYPE) {
    fiberTag = SuspenseComponent;
  } else if (typeof type !== "function" && __DEV__) {
    console.log("未定义的type类型", element);
  }
  const fiber = new FiberNode(fiberTag, props, key);
  fiber.type = type;
  fiber.ref = ref;
  return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
  const fiber = new FiberNode(Fragment, elements, key);
  return fiber;
}

export function createFiberFromOffscreen(
  pendingProps: OffscreenProps
): FiberNode {
  const fiber = new FiberNode(OffscreenComponent, pendingProps, null);
  return fiber;
}
