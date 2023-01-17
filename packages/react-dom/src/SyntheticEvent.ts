import { Props } from "shared/ReactTypes";
import { Container } from "hostConfig";

export const elementPropsKey = "__props";
const validEventTypeList = ["click"];

type EventCallback = (e: Event) => void;

// 合成事件
interface SyntheticEvent extends Event {
  __stopPropagation: boolean;
}

interface Paths {
  capture: EventCallback[];
  bubble: EventCallback[];
}

export interface DOMElement extends Element {
  [elementPropsKey]: Props;
}

// dom.__props = reactElement props
export function updateFiberProps(node: DOMElement, props: Props) {
  node[elementPropsKey] = props;
}

export function initEvent(container: Container, eventType: string) {
  if (!validEventTypeList.includes(eventType)) {
    console.warn("当前不支持", eventType, "事件");
    return;
  }

  if (__DEV__) {
    console.log("初始化事件：", eventType);
  }

  container.addEventListener(eventType, (e: Event) => {
    dispatchEvent(container, eventType, e);
  });
}

function createSyntheticEvent(e: Event) {
  const syntheticEvent = e as SyntheticEvent;
  syntheticEvent.__stopPropagation = false;
  const originStopPropagation = e.stopPropagation.bind(e);

  syntheticEvent.stopPropagation = () => {
    syntheticEvent.__stopPropagation = true;
    if (originStopPropagation) {
      originStopPropagation();
    }
  };
  return syntheticEvent;
}

/**
 *
 * @param container
 * @param eventType
 * @param e
 */
function dispatchEvent(container: Container, eventType: string, e: Event) {
  const targetElement = e.target;

  if (targetElement === null) {
    console.warn("事件不存在target", e);
  }
  // 1. 收集沿途的事件
  const { bubble, capture } = collectPaths(
    targetElement as DOMElement,
    container,
    eventType
  );
  // 2. 构造合成事件
  const se = createSyntheticEvent(e);
  // 3. 遍历capture
  triggerEventFlow(capture, se);
  // 4. bubble
  if (!se.__stopPropagation) {
    triggerEventFlow(bubble, se);
  }
}

function triggerEventFlow(paths: EventCallback[], se: SyntheticEvent) {
  for (let i = 0; i < paths.length; i++) {
    const callback = paths[i];
    callback.call(null, se);

    if (se.__stopPropagation) {
      break;
    }
  }
}

function getEventCallbackNameFromEventType(
  eventType: string
): string[] | undefined {
  return {
    click: ["onClickCapture", "onClick"],
  }[eventType];
}

function collectPaths(
  targetElement: DOMElement,
  container: Container,
  eventType: string
) {
  const paths: Paths = {
    capture: [],
    bubble: [],
  };

  /**
   * div#container     onClick onClickCapture
   *    div   onClick onClickCapture
   *       p  onClick  点击
   *       bubble [p onClick, div onClick, container Onclick]
   *       capture [container onClickCapture, div onClickCapture]
   */
  while (targetElement && targetElement !== container) {
    // 收集
    const elementProps = targetElement[elementPropsKey];
    if (elementProps) {
      const callbackNameList = getEventCallbackNameFromEventType(eventType);
      if (callbackNameList) {
        callbackNameList.forEach((callbackName, i) => {
          const eventCallback = elementProps[callbackName];
          if (eventCallback) {
            if (i === 0) {
              //capture
              paths.capture.unshift(eventCallback);
            } else {
              paths.bubble.push(eventCallback);
            }
          }
        });
      }
    }
    targetElement = targetElement.parentNode as DOMElement;
  }
  return paths;
}
