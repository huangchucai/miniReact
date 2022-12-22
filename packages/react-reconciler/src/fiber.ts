import { WorkTag } from "./workTags";
import { Key, Props, Ref } from "shared/ReactTypes";
import { Flags, NoFlags } from "./fiberFlags";

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
  alternate: FiberNode | null;
  flags: Flags;

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

    this.alternate = null; // 双缓存树指向(workInProgress 和 current切换）

    this.flags = NoFlags;
  }
}
