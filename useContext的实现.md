# useContext的实现
本系列是讲述从0开始实现一个react18的基本版本。通过实现一个基本版本，让大家深入了解`React`内部机制。
由于`React`源码通过**Mono-repo** 管理仓库，我们也是用`pnpm`提供的`workspaces`来管理我们的代码仓库，打包我们使用`rollup`进行打包。

[仓库地址](https://github.com/huangchucai/miniReact)

[本节对应的代码](https://github.com/huangchucai/miniReact/commit/b9aef55f7b68a1ba96e1bccaddda18ec4e3ea415)

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
15. [useRef的实现](https://juejin.cn/post/7229117452470190141)

前面我们已经讲了`useRef`的实现，这节我们来讲一下`useContext`的实现。本节我们只针对函数组件的使用进行分析和实现。

## 1. context的基本使用
当我们需要跨组件传递数据的时候，通常我们会使用`context`来进行传递。`context`的使用方式分为下面2个步骤：
1. 创建`context`对象`const context = React.createContext(defaultValue)`
2. 使用`context`对象的`Provider`组件进行包裹，`<context.Provider value={value}>`，`value`就是我们需要传递的数据
3. 在需要使用`value`的地方，调用`useContext`函数，`const value = useContext(context)`

```javascript
// 1. 创建context对象
const ctx = createContext(null);

// 2. 使用context对象的Provider组件进行包裹
<ctx.Provider value={num}>
  <div onClick={() => update(Math.random())}>
    <Middle />
  </div>
</ctx.Provider>

// 3. 在需要使用value的地方，调用useContext函数
function Child() {
  const val = useContext(ctx);
  return <p>{val}</p>;
}
```

所以我们需要实现如下的几个点：
1. `createContext`函数
2. `Provider`组件
3. `useContext`函数

## 2. createContext函数
`createContext`函数的作用是创建一个`context`对象，这个对象包含了`Provider`组件和`Consumer`组件。但是我们目前不考虑`Consumer`, 我们先来看一下`createContext`函数的返回情况：
1. `Provider`组件
2. `_currentValue`: 保存`Provider`组件的`value`值
3. `$$typeof`: 用来标记这个对象是一个`context`对象

```javascript
export function createContext<T>(defaultValue: T): ReactContext<T> {
  const context: ReactContext<T> = {
    $$typeof: REACT_CONTEXT_TYPE,
    Provider: null,
    _currentValue: defaultValue,
  };
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };
  return context;
}
```

## 3. `ctx.Provider`组件的编译过程
当我们写了`<ctx.Provider value={num}>`的时候，在开发环境`babel`会将其编译成如下的代码：
```javascript
 jsxDEV(ctx.Provider, { value: num, children: /* @__PURE__ */ jsxDEV("div", { onClick: () => update(Math.random()), children: 'xxxx'})});
```

所以当执行到`jsxDEV(ctx.Provider,xxx)`的时候， 基于之前的`jsxDEV`的逻辑，我们会得到如下的`ReactElement`的结构。
```javascript
let ctx_Provider_ReactElement = {
  $$typeof: REACT_ELEMENT_TYPE,
  type: {
    $$typeof:Symbol(react.provider),
    _context: 'xxxx'
  },
  props: {
    value: 0,
    children: {
      xxxx
    }
  },
  xxxx
}
```

### 3.1 beginWork基于父节点处理新的类型
之前我们在处理`beginWork`进行调和的时候，我们已经知道我们会根据相应的`reactElement`生成相应的`fiber`节点，所以`ctx.Provider`的父亲节点开始`beginWork`的时候，
会根据`ReactElement`的`type`进行生成子节点的`fiber`节点，但是这里`ctx.Provider`的`type`是一个对象，所以我们需要对`type`进行特殊的处理。

```javascript
export function createFiberFromElement(element: ReactElementType): FiberNode {
  // xxxxxx
  if (
    // <Context.Provider/>
    typeof type === "object" &&
    type.$$typeof === REACT_PROVIDER_TYPE
  ) {
    fiberTag = ContextProvider;
  }
  // xxxxxx
}
```
这里我们就根据`ReactElement`的`type`生成了`ctx.Provider`对应的`fiber`。

### 3.2 `ctx.Provider`对应的调和过程
当我们在`beginWork`的时候，遍历到`ctx.Provider`的fiber的时候，我们需要根据特定的`tag`进行不同的处理，这里我们需要根据`tag`进行不同的处理。
```javascript
export const beginWork = (wip: FiberNode, renderLane: Lane) => {
  switch (wip.tag) {
    case ContextProvider:
      return updateContextProvider(wip);
  }
}
```
在`updateContextProvider`中，我们除了要继续调和子节点之外，还需要进行一些特定的逻辑。


### 3.3 context当前值的入栈与出栈
当我们使用`context`的时候，会出现嵌套使用的情况，取值获取最近的`Provider`的`value`值。所以我们需要将`value`值进行入栈和出栈的操作。
```javascript
// 例如这个嵌套的例子
const ctx = createContext(null);

function App() {
  return (
    <ctx.Provider value={0}>
      <Child />
      <ctx.Provider value={1}>
        <Child />
        <ctx.Provider value={2}>
          <Child />
        </ctx.Provider>
      </ctx.Provider>
    </ctx.Provider>
  );
}

function Child() {
  const val = useContext(ctx);
  return <p>{val}</p>;
}
```
三个不同的`child`组件，分别获取到了不同的`value`值，这样是怎么操作的。

目前如果实现简单的功能来说，我们只需要在调和的时候，将`value`值保存到当前`context`的`_currentValue`中。

在子节点调和阶段， 执行`useContext`传递的`context`，然后去获取`_currentValue`的值，这样就可以获取到最近的`Provider`的`value`值。

但是`React`的原生中，为了更复杂的场景，他使用了一个数组模拟出栈、入栈的操作，这样可以更好的处理复杂的场景。

```javascript
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
```


### `updateContextProvider`的细节实现
它和其他的`beginWork`的递归子节点实现基本一致，只是多了一些`context`的处理， 主要是需要保存当前的`context`的值。

当然还有一些优化的逻辑，这个之后再进行补充，需要对比新旧2个值是否发生变化，判断是否需要继续向下调和。

```javascript
function updateContextProvider(wip: FiberNode) {
  const providerType = wip.type;
  // {
  //   $$typeof: symbol | number;
  //   _context: ReactContext<T>;
  // }
  const context = providerType._context;
  const oldProps = wip.memoizedProps; // 旧的props <Context.Provider value={0}> {value, children}
  const newProps = wip.pendingProps;

  const newValue = newProps.value; // 新的value

  if (oldProps && newValue !== oldProps.value) {
    // context.value发生了变化  向下遍历找到消费的context
    // todo: 从Provider向下DFS，寻找消费了当前变化的context的consumer
    // 如果找到consumer, 从consumer开始向上遍历到Provider
    // 标记沿途的组件存在更新
  }

  // 逻辑 - context入栈
  if (__DEV__ && !("value" in newProps)) {
    console.warn("<Context.Provider>需要传入value");
  }
  pushProvider(context, newValue);

  const nextChildren = wip.pendingProps.children;
  reconcileChildren(wip, nextChildren);
  return wip.child;
}
```

### `useContext`的实现
`useContext`的实现就是获取当前`context`的`_currentValue`的值
```javascript
function readContext<T>(context: ReactContext<T>) {
  const consumer = currentlyRenderingFiber;
  if (consumer === null) {
    throw new Error("context需要有consumer");
  }
  const value = context._currentValue;
  return value;
}
```

## 总结
这就是`context`的传递的整个过程，当然还有一些细节的处理，这里就不一一展开了，这里只是简单的实现了`context`的传递的整个过程。
