import {
  FulfilledThenable,
  PendingThenable,
  RejectedThenable,
  Thenable,
} from "shared/ReactTypes";

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}

export const SuspenseException = new Error(
  "这不是真实的错误, 是Suspense工作的一部分, 如果你捕获到这个错误，请将它继续抛出去"
);

let suspendedThenable: Thenable<any> | null = null;

export function getSuspenseThenable(): Thenable<any> {
  if (suspendedThenable === null) {
    throw new Error("应该存在suspendedThenable，这是一个bug");
  }
  const thenable = suspendedThenable;
  suspendedThenable = null;
  return thenable;
}

export function trackUsedThenable<T>(thenable: Thenable<T>) {
  switch (thenable.status) {
    case "fulfilled":
      return thenable.value;
    case "rejected":
      throw thenable.reason;
    default:
      if (typeof thenable.status === "string") {
        thenable.then(noop, noop);
      } else {
        // untracked

        //pending
        const pending = thenable as unknown as PendingThenable<T, void, any>;
        pending.status = "pending";
        pending.then(
          (val) => {
            if (pending.status === "pending") {
              // @ts-ignore
              const fulfilled: FulfilledThenable<T, void, any> = pending;
              fulfilled.status = "fulfilled";
              fulfilled.value = val;
            }
          },
          (err) => {
            // @ts-ignore
            const rejected: RejectedThenable<T, void, any> = pending;
            rejected.status = "rejected";
            rejected.reason = err;
          }
        );
      }
      break;
  }
  suspendedThenable = thenable;
  throw SuspenseException;
}
