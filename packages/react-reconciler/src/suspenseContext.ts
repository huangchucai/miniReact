import { FiberNode } from "./fiber";

const suspenseHandlerStack: FiberNode[] = [];

export function getSuspenseHandler() {
  return suspenseHandlerStack[suspenseHandlerStack.length - 1];
}

export function pushSuspenseHandler(fiber: FiberNode) {
  suspenseHandlerStack.push(fiber);
}

export function popSuspenseHandler() {
  suspenseHandlerStack.pop();
}
