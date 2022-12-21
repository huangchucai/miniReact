// ReactElement

import { REACT_ELEMENT_TYPE } from "../../shared/ReactSymbols";
import { Key, Props, ReactElementType, Ref, Type } from "shared/ReactTypes";

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

export default {
  ReactElement,
};
