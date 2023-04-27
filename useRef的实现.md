# useRef的实现
本系列是讲述从0开始实现一个react18的基本版本。通过实现一个基本版本，让大家深入了解`React`内部机制。
由于`React`源码通过**Mono-repo** 管理仓库，我们也是用`pnpm`提供的`workspaces`来管理我们的代码仓库，打包我们使用`rollup`进行打包。

[仓库地址](https://github.com/huangchucai/miniReact)

[本节对应的代码](https://github.com/huangchucai/miniReact/commit/0337f43ff401d79af40791bfa99e997b85975d6c)

**系列文章：**
1. [React实现系列一 - jsx](https://juejin.cn/post/7181356579709517861)
2. [剖析React系列二-reconciler](https://juejin.cn/post/7182148488665399353)
3. [剖析React系列三-打标记](https://juejin.cn/post/7183301269094662205)
4. [剖析React系列四-commit](https://juejin.cn/post/7183611473715789884)
5. [剖析React系列五-update流程](https://juejin.cn/post/7186264376356110393)
6. [剖析React系列六-dispatch update流程](https://juejin.cn/post/7187976209844666426)
7. [剖析React系列七-事件系统](https://juejin.cn/post/7189564391648395321)
8. [剖析React系列八-同级节点diff](https://juejin.cn/post/7192593896319221820)
9. [剖析React系列九-Fragment的部分实现逻辑](https://juejin.cn/post/7195061461742256183)
10. [剖析React系列十- 调度<合并更新、优先级>](https://juejin.cn/post/7197010875399749692)
11. [剖析React系列十一- useEffect的实现原理](https://juejin.cn/post/7199254597915181117)
12. [剖析React系列十二-调度器的实现](https://juejin.cn/post/7209547043936010299)
13. [剖析React系列十三-react调度](https://juejin.cn/post/7212101192745500728)
14. [useTransition的实现](https://juejin.cn/post/7214735181172047931)

本章我们来讲解`useRef`的使用和实现原理。

## useRef的使用
`useRef`的使用非常简单，我们可以通过`useRef`来获取一个可变的`ref`对象，`ref`对象的`.current`属性在重复渲染的过程中，会保持引用不变，我们可以通过`ref`对象来获取`dom`节点，或者在重复渲染中不变的值。

`useRef` 接受一个初始值, 返回一个对象，包含`.current`属性。
```js
let ref = useRef(null)
```

通常我们用它去获取渲染的`dom`节点， 有一下2种方式：
```js
// 第一种：直接赋值给ReactElement的ref属性
let ref = useRef(null)
function App() {
  return <div ref={ref}>hello world</div>
}

// 第二种：通过函数的形式, 将dom传递给函数的参数
let ref = useRef(null)
function App() {
  return <div ref={(dom) => {ref.current = dom}}>hello world</div>
}
```

接下来我们来看看`useRef`的实现原理。

## 获取ref值
当我们传递给`reactElement`的`ref`属性的时候，首先我们将其`ref`的属性值赋值到对应的`fiber`节点上。

所以我们要修改`fiber.ts`中的`createFiberFromElement`以及`createWorkInProgress`方法。
```diff
export function createFiberFromElement(element: ReactElementType): FiberNode {
+ const { type, key, props, ref } = element;
  let fiberTag: WorkTag = FunctionComponent;
  ...
+ fiber.ref = ref;
  return fiber;
}

export const createWorkInProgress = (
  current: FiberNode,
  pendingProps: Props
): FiberNode => {
  let wip = current.alternate;
  ...
+ wip.ref = current.ref;
  return wip;
};
```
这样我们在进行调和`reconciler`的时候，就可以获取到`ref`的值了。

## `reconciler`阶段
之前的章节我们晓得调和阶段分为2个阶段：
1. `beginWork`阶段
2. `completeWork`阶段

对于`ref`的处理，这2个阶段主要是针对有`ref`属性的`fiber`进行打标记处理。

正常情况下，我们只需要在`beginWork`中打好标记，这里的`completeWork`中是兜底操作。

### 新增一个`flag`类型
我们在`fiberFlags`中新增一个`ref`类型，用来表示`ref`的打标记。同时新增一个`LayoutMask`，用来表示`layout`阶段要执行的标志。
```javascript
export const Ref = 0b0010000; // ref
export const LayoutMask = Ref; // layout阶段要执行的标志
```
新增了一个`Ref`的标志后，我们接下来就需要根据条件判断是否要打上这个标记。

### `beginWork`阶段
在`beginWork`阶段，我们需要对2种情况进行处理：
1. 刚刚初始化的时候，`wip.alternate`为`null`，这个时候我们需要判断`fiber`节点是否有`ref`属性，如果有，就打上`Ref`标记。
2. `wip.alternate`不为`null`，这个时候我们需要判断`fiber`节点的`ref`属性是否发生变化，如果发生变化，就打上`Ref`标记。

在调和的过程中，如果遇到`wip.tag`为`updateHostComponent`的时候，标识这是一个`dom`类型的fiber，我们就可以判断是否有`ref`属性了。

```javascript
function updateHostComponent(wip: FiberNode) {
  // ....
  markRef(wip.alternate, wip);
  // ....
  return wip.child;
}

/**
 * 标记Ref
 */
function markRef(current: FiberNode | null, workInProgress: FiberNode) {
  const ref = workInProgress.ref;
  // mount时 有ref 或者 update时 ref变化
  if (
    (current === null && ref !== null) ||
    (current !== null && current.ref !== ref)
  ) {
    workInProgress.flags |= Ref;
  }
}
```

### `completeWork`阶段
在`completeWork`阶段，主要是进行兜底操作。

由于本身已经区分了初始化和更新的情况，所以我们只需要在不同的情况下判断即可, 所以针对`HostComponent`类型进行如下判断：
```javascript
// 更新阶段
// 标记ref
if (current.ref !== wip.ref) {
  markRef(wip);
}

// 初始化阶段
// 标记Ref
if (wip.ref !== null) {
  markRef(wip);
}

function markRef(fiber: FiberNode) {
  fiber.flags |= Ref;
}
```

## `commit`阶段
在`commit`阶段，我们需要对`Ref`标记进行处理，在之前的[commit阶段文章](https://juejin.cn/post/7183611473715789884)，我们了解到`commit`分为三个子阶段：
* `beforeMutation`阶段
* `mutation`阶段
* `layout`阶段
针对`ref`的处理，主要是在`mutation`子阶段进行原有的`ref`值的解绑， `layout`阶段需要绑定新的值。

### 解绑和绑定
对于`mutation`阶段的解绑操作, 获取到`ref`的值，然后判断是否是函数，如果是函数的话就传递`null`，否者，就将`current`设置为`null`。
```javascript
  // 解绑之前的Ref
  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    safelyDetachRef(finishedWork);
  }
/**
 *  解绑当前的ref
 */
function safelyDetachRef(current: FiberNode) {
  const ref = current.ref;
  if (ref !== null) {
    if (typeof ref === "function") {
      ref(null);
    } else {
      ref.current = null;
    }
  }
}
```

在`layout`阶段进行重新的绑定。
```javascript
  if ((flags & Ref) !== NoFlags && tag === HostComponent) {
    // 绑定新的ref
    safelyAttachRef(finishedWork);
  }

/**
 *  绑定新的ref
 */
function safelyAttachRef(fiber: FiberNode) {
  const ref = fiber.ref;
  if (ref !== null) {
    const instance = fiber.stateNode;
    if (typeof ref === "function") {
      ref(instance);
    } else {
      ref.current = instance;
    }
  }
}
```

### 卸载
当被绑定的`fiber`节点被卸载的时候，我们需要对`ref`进行解绑操作。 我们知道在卸载的时候会执行`commitDeletion`, 所以针对`hostComponent`类型的`fiber`节点，我们需要进行解绑操作。
```javascript
function commitDeletion(childToDelete: FiberNode, root: FiberRootNode) {
  const rootChildrenToDelete: FiberNode[] = [];
  // 递归子树
  commitNestedComponent(childToDelete, (unmountFiber) => {
    switch (unmountFiber.tag) {
      case HostComponent:
        // xxxxxx
        safelyDetachRef(unmountFiber);
        return;
    }
    // xxxxx
  })
}
```

## ref重复渲染值不变
我们知道在重复渲染的时候`ref.current`的值是保持不变的，那么它是如何实现的呢？ 我们来看看`useRef`的2个阶段的实现代码。
```javascript
/**
 * useRef使用 ref = useRef(null)
 * @param initialValue
 */
function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;
}
```
在初始化的时候调用`mountRef`函数。我们创建一个`{current: initialValue}`的对象，然后将这个对象赋值给`hook.memoizedState`。 

对于不同的hook，都是通过对于的`hook.memoizedState`来保存数据的。

在更新的时候，我们调用`updateRef`函数，这个时候我们直接返回`hook.memoizedState`，也就是说，我们返回的是同一个对象，所以`ref.current`的值是不会变化的。


## 总结
至此，函数组件针对`ref`的2种处理就都完成了。

通过上面的讲解，我们应该知道了，当我们通过函数接受`dom`的时候，会触发2次函数的执行，第一次是**解绑操作**，第二次是**绑定操作**。


