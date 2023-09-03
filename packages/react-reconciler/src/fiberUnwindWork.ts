import { FiberNode } from "./fiber";
import { ContextProvider, SuspenseComponent } from "./workTags";
import { popSuspenseHandler } from "./suspenseContext";
import { DidCapture, NoFlags, ShouldCapture } from "./fiberFlags";
import { popProvider } from "./fiberContext";

/**
 * unwind的每一个fiberNode 的具体操作
 * @param wip
 */
export function unwindWork(wip: FiberNode) {
  const flags = wip.flags;
  switch (wip.tag) {
    case SuspenseComponent:
      popSuspenseHandler();
      if (
        (flags & ShouldCapture) !== NoFlags &&
        (flags & DidCapture) === NoFlags
      ) {
        // 找到了距离我们最近的suspense
        wip.flags = (flags & ~ShouldCapture) | DidCapture; // 移除ShouldCapture、 添加DidCapture
        return wip;
      }
      return null;
      break;
    case ContextProvider:
      const context = wip.type._context;
      popProvider(context);
      return null;
    default:
      return null;
  }
}
