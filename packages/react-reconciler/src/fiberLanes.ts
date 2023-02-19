import { FiberRootNode } from "./fiber";
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
export const SyncLane = 0b0001;
export const InputContinuousLane = 0b0010; // 连续输入的事件
export const DefaultLane = 0b0100;
export const IdleLane = 0b1000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
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

export function markRootFinished(root: FiberRootNode, lane: Lane) {
  root.pendingLanes &= ~lane;
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
