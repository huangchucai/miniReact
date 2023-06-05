export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText
  | typeof Fragment
  | typeof ContextProvider;

/**
 * fiber节点对应的 tag属性
 */
export const FunctionComponent = 0;
export const HostRoot = 3; // 根节点
export const HostComponent = 5; // <div>节点
export const HostText = 6; //<div>123</div> div里面的文本
export const Fragment = 7; //Fragment 类型

export const ContextProvider = 11; // Context.Provider
// export const ContextConsumer = 12; // Context.Provider
