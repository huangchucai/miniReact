// ReactElement

import { REACT_ELEMENT_TYPE, REACT_FRAGMENT_TYPE } from "shared/ReactSymbols";
import {
  ElementType,
  Key,
  Props,
  ReactElementType,
  Ref,
  Type,
} from "shared/ReactTypes";

const ReactElement = function (
  type: Type,
  key: Key,
  ref: Ref,
  props: Props
): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key,
    ref,
    props,
    __mark: "hcc",
  };
  return element;
};
export function isValidElement(object: any) {
  return (
    typeof object === "object" &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}

export const jsx = (type: ElementType, config: any, ...maybeChildren: any) => {
  let key: Key = null;
  const props: Props = {};
  let ref: Ref = null;
  for (const prop in config) {
    const val = config[prop];
    if (prop === "key") {
      if (val !== undefined) {
        key = "" + val;
      }
      continue;
    }
    if (prop === "ref") {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  const maybeChildrenLength = maybeChildren.length;
  if (maybeChildrenLength) {
    // child  [child, child, child]
    if (maybeChildrenLength === 1) {
      props.children = maybeChildren[0];
    } else {
      props.children = maybeChildren;
    }
  }
  return ReactElement(type, key, ref, props);
};

export const Fragment = REACT_FRAGMENT_TYPE;

export const jsxDEV = (type: ElementType, config: any, key: any = null) => {
  const props: Props = {};
  let ref: Ref = null;
  for (const prop in config) {
    const val = config[prop];
    if (prop === "ref") {
      if (val !== undefined) {
        ref = val;
      }
      continue;
    }
    if ({}.hasOwnProperty.call(config, prop)) {
      props[prop] = val;
    }
  }
  return ReactElement(type, key, ref, props);
};
