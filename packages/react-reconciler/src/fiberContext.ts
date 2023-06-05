import { ReactContext } from "shared/ReactTypes";

const valueStack: any[] = [];
export function pushProvider<T>(context: ReactContext<T>, newValue: T) {
  valueStack.push(newValue);
  context._currentValue = newValue;
}

export function popProvider<T>(context: ReactContext<T>) {
  context._currentValue = valueStack[valueStack.length - 1];
  valueStack.pop();
}
