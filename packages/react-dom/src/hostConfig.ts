import { FiberNode } from "react-reconciler/src/fiber";
import { HostText } from "react-reconciler/src/workTags";
import { DOMElement, updateFiberProps } from "./SyntheticEvent";
import { Props } from "shared/ReactTypes";

export type Container = Element;
export type Instance = Element;
export type TestInstance = Text;

export const createInstance = (type: string, props: Props): Instance => {
  // TODO 处理props
  const element = document.createElement(type) as unknown;
  updateFiberProps(element as DOMElement, props);
  return element as DOMElement;
};

export const appendInitialChild = (
  parent: Instance | Container,
  child: Instance
) => {
  parent.appendChild(child);
};

export const createTextInstance = (content: string) => {
  return document.createTextNode(content);
};

export const appendChildToContainer = appendInitialChild;

export function commitUpdate(fiber: FiberNode) {
  switch (fiber.tag) {
    case HostText:
      const text = fiber.memoizedProps.content;
      return commitTextUpdate(fiber.stateNode, text);
    default:
      if (__DEV__) {
        console.warn("未实现的update", fiber);
      }
      break;
  }
}

export function commitTextUpdate(textInstance: TestInstance, content: string) {
  textInstance.textContent = content;
}

export function removeChild(
  child: Instance | TestInstance,
  container: Container
) {
  container.removeChild(child);
}

export function insertChildToContainer(
  child: Instance,
  container: Container,
  before: Instance
) {
  container.insertBefore(child, before);
}
