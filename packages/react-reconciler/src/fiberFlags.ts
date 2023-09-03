export type Flags = number;

export const NoFlags = 0b0000000; // 没有副作用
export const Placement = 0b0000001; // 插入
export const Update = 0b0000010; // 更新
export const ChildDeletion = 0b0000100; // 删除
export const PassiveEffect = 0b0001000; // 当前fiber上本次更新存在副作用
export const Ref = 0b0010000; // ref

/**
 * current Offscreen mode 和 wip Offscreen mode 的对比
 */
export const Visibility = 0b0100000; // Offscreen 的可见度发生变化（hide/visibility的切换)

// 需要unWind的suspense
export const DidCapture = 0b1000000;

export const ShouldCapture = 0b01000000000; // render阶段，捕获到一些东西(Error Bound / 抛出的挂载的数据）

/** 是否需要执行mutation阶段 */
export const MutationMask =
  Placement | Update | ChildDeletion | Ref | Visibility; //mutation阶段要执行的标志
export const LayoutMask = Ref; // layout阶段要执行的标志

/** 是否需要触发useEffect回调  */
export const PassiveMask = PassiveEffect | ChildDeletion;
