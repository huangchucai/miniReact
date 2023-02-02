export type Flags = number;

export const NoFlags = 0b0000000; // 没有副作用
export const Placement = 0b0000001; // 插入
export const Update = 0b0000010; // 更新
export const ChildDeletion = 0b0000100; // 删除

export const PassiveEffect = 0b0001000; // 当前fiber上本次更新存在副作用
/** 是否需要执行mutation阶段 */
export const MutationMask = Placement | Update | ChildDeletion;

/** 是否需要触发useEffect回调  */
export const PassiveMask = PassiveEffect | ChildDeletion;
