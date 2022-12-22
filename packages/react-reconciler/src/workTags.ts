export type WorkTag =
  | typeof FunctionComponent
  | typeof HostRoot
  | typeof HostComponent
  | typeof HostText;

export const FunctionComponent = 0;
export const HostRoot = 3; // 根节点
export const HostComponent = 5; // <div>节点
export const HostText = 6; //<div>123</div> div里面的文本
