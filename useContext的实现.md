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

## 1. useContext的基本使用
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

### 3.1 beginWork基于新的类型进行处理
之前我们在处理`beginWork`进行
