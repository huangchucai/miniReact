import { FiberRootNode } from "./fiber";
import { Lane } from "./fiberLanes";
import { Wakeable } from "shared/ReactTypes";
import { ensureRootIsScheduled, markRootUpdated } from "./workLoop";
import { getSuspenseHandler } from "./suspenseContext";
import { ShouldCapture } from "./fiberFlags";

export function throwException(root: FiberRootNode, value: any, lane: Lane) {
  // Error Boundary

  // thenable
  if (
    value !== null &&
    typeof value === "object" &&
    typeof value.then === "function"
  ) {
    const wakeable: Wakeable<any> = value;

    const suspenseBoundary = getSuspenseHandler();
    if (suspenseBoundary) {
      suspenseBoundary.flags |= ShouldCapture;
    }

    attachPingListener(root, wakeable, lane);
  }
}

function attachPingListener(
  root: FiberRootNode,
  wakeable: Wakeable<any>,
  lane: Lane
) {
  // wakeable.then(ping, ping);
  let pingCache = root.pingCache;

  // WeakMap { promise: Set<Lane> }
  let threadIDS: Set<Lane> | undefined;

  if (pingCache === null) {
    threadIDS = new Set<Lane>();
    pingCache = root.pingCache = new WeakMap<Wakeable<any>, Set<Lane>>();
    pingCache.set(wakeable, threadIDS);
  } else {
    threadIDS = pingCache.get(wakeable);
    if (threadIDS === undefined) {
      threadIDS = new Set<Lane>();
      pingCache.set(wakeable, threadIDS);
    }
  }

  if (!threadIDS.has(lane)) {
    threadIDS.add(lane);

    // 触发新的更新
    // eslint-disable-next-line no-inner-declarations
    function ping() {
      if (pingCache !== null) {
        pingCache.delete(wakeable);
      }

      // fiberRootNode
      markRootUpdated(root, lane);
      ensureRootIsScheduled(root);
    }

    wakeable.then(ping, ping);
  }
}
