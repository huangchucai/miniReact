import { FiberRootNode } from "./fiber";
import ReactCurrentBatchConfig from "react/src/currentBatchConfig";
import {
  unstable_getCurrentPriorityLevel,
  unstable_IdlePriority,
  unstable_ImmediatePriority,
  unstable_NormalPriority,
  unstable_UserBlockingPriority,
} from "scheduler";

export type Lane = number;
// 集合
export type Lanes = number;

export const NoLane = 0b0000;
export const NoLanes = 0b0000;

// lane模型
export const SyncLane = 0b00001; // unstable_ImmediatePriority
export const InputContinuousLane = 0b00010; // 连续输入的事件 -> unstable_UserBlockingPriority
export const DefaultLane = 0b00100; // -> unstable_NormalPriority
export const TransitionLane = 0b01000; // -> transition 对应的优先级
export const IdleLane = 0b10000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
  // 增加transition 逻辑
  const isTransition = ReactCurrentBatchConfig.transition !== null;
  if (isTransition) {
    return TransitionLane;
  }

  // 从调度器中获取优先级
  const currentSchedulerPriority = unstable_getCurrentPriorityLevel();
  // scheduler优先级  to lane
  const lane = schedulerPriorityToLane(currentSchedulerPriority);
  return lane;
}

/**
 * 获取优先级最高的lane  ->  越小优先级越高
 * @param {Lanes} lanes
 * @returns {Lane}
 */
export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

/**
 * 判断优先级是否足够更新(交集）
 */
export function isSubsetOfLanes(set: Lanes, subset: Lane) {
  return (set & subset) === subset;
}

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;

  root.suspendedLanes = NoLanes;
  root.pendingLanes = NoLanes;
}

/**
 * 从lane 转换到 调度器的优先级
 * @param lanes
 */
export function lanesToSchedulerPriority(lanes: Lanes) {
  const lane = getHighestPriorityLane(lanes);

  if (lane === SyncLane) {
    return unstable_ImmediatePriority;
  }
  if (lane === InputContinuousLane) {
    return unstable_UserBlockingPriority;
  }
  if (lane === DefaultLane) {
    return unstable_NormalPriority;
  }
  return unstable_IdlePriority;
}

/**
 * 从调度器的优先级  转换到  lane
 * @param schedulerPriority
 */
export function schedulerPriorityToLane(schedulerPriority: number) {
  if (schedulerPriority === unstable_ImmediatePriority) {
    return SyncLane;
  }
  if (schedulerPriority === unstable_UserBlockingPriority) {
    return InputContinuousLane;
  }
  if (schedulerPriority === unstable_NormalPriority) {
    return DefaultLane;
  }
  return NoLane;
}

/**
 * 标记挂起的lane
 * @param root
 * @param suspendedLane
 */
export function markRootSuspended(root: FiberRootNode, suspendedLane: Lanes) {
  root.suspendedLanes |= suspendedLane;
  root.pingedLanes &= ~suspendedLane;
}

/**
 * 标记ping的lane (ping的lane一定是suspendedLane的子集）
 */
export function markRootPinged(root: FiberRootNode, pingedLane: Lanes) {
  root.pingedLanes |= root.suspendedLanes & pingedLane;
}

export function getNextLane(root: FiberRootNode): Lane {
  const pendingLanes = root.pendingLanes;

  if (pendingLanes === NoLanes) {
    return NoLane;
  }

  let nextLane = NoLane;

  const suspendedLanes = pendingLanes & ~root.suspendedLanes;

  if (suspendedLanes !== NoLanes) {
    nextLane = getHighestPriorityLane(suspendedLanes);
  } else {
    const pingedLanes = pendingLanes & root.pingedLanes;
    if (pingedLanes !== NoLanes) {
      nextLane = getHighestPriorityLane(pingedLanes);
    }
  }
  return nextLane;
}
