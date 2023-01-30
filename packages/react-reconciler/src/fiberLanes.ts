import { FiberRootNode } from "./fiber";

export type Lane = number;
// 集合
export type Lanes = number;

export const SyncLane = 0b0001;
export const NoLane = 0b0000;
export const NoLanes = 0b0000;

export function mergeLanes(laneA: Lane, laneB: Lane): Lanes {
  return laneA | laneB;
}

export function requestUpdateLane() {
  return SyncLane;
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
