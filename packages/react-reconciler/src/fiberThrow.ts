import { FiberRootNode } from "./fiber";
import { Lane, markRootPinged } from "./fiberLanes";
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

/**
 * 缓存的作用： 多次进入attachPingListener的时候，只会执行一次 wakeable.then(ping, ping);
 * 这样就不会多次插入ping
 * @param root
 * @param wakeable
 * @param lane
 */
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
    // 查找是否可以找到可以唤醒的 theadIDS
    threadIDS = pingCache.get(wakeable);
    if (threadIDS === undefined) {
      threadIDS = new Set<Lane>();
      pingCache.set(wakeable, threadIDS);
    }
  }

  // 第一次进入
  if (!threadIDS.has(lane)) {
    threadIDS.add(lane);

    // 触发新的更新
    // eslint-disable-next-line no-inner-declarations
    function ping() {
      if (pingCache !== null) {
        pingCache.delete(wakeable);
      }

      // fiberRootNode
      markRootPinged(root, lane);
      markRootUpdated(root, lane);
      ensureRootIsScheduled(root);
    }

    wakeable.then(ping, ping);
  }
}
