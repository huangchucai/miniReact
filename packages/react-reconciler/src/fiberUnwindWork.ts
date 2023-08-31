import { FiberNode } from "./fiber";
import { ContextProvider, SuspenseComponent } from "./workTags";
import { popSuspenseHandler } from "./suspenseContext";
import { DidCapture, NoFlags, ShouldCapture } from "./fiberFlags";
import { popProvider } from "./fiberContext";

export function unwindWork(wip: FiberNode) {
  const flags = wip.flags;
  switch (wip.tag) {
    case SuspenseComponent:
      popSuspenseHandler();
      if (
        (flags & ShouldCapture) !== NoFlags &&
        (flags & DidCapture) === NoFlags
      ) {
        wip.flags = (flags & ~ShouldCapture) | DidCapture;
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
