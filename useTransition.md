## `useTransiton`的实现

本系列是讲述从0开始实现一个react18的基本版本。通过实现一个基本版本，让大家深入了解`React`内部机制。
由于`React`源码通过**Mono-repo** 管理仓库，我们也是用`pnpm`提供的`workspaces`来管理我们的代码仓库，打包我们使用`rollup`进行打包。

[仓库地址](https://github.com/huangchucai/miniReact)

[本节对应的代码](https://github.com/huangchucai/miniReact/commit/44fa814130a0b0aab444a8289cd5de392f520801)

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

本章我们通过一个实际的api来讲解react的并发中的运用。在React18中，新增了一个`useTransition`的api，我们先来看一下这个api的使用。

## useTransition的使用
`useTransition`主要的目的是让我们更新状态，但是不去堵塞UI的渲染。
```jsx
const [isPending, startTransition] = useTransition()
```
它不接受任务参数，返回一个数组。包含`ispending`告诉我们当前的任务的状态。`startTransition`是一个函数，接受一个函数，用来更新状态，启动更新。
具体的例子和使用可以看[官方文档](https://react.dev/reference/react/useTransition#updating-the-parent-component-in-a-transition)。

## useTransition的实现
从之前的章节中，我们晓得`react`内部通过优先级来区分任务的执行顺序。`useTransition`通过低优先级的更新策略来实现不堵塞UI的渲染。

`useTransition`的作用分为2个部分：
1. 切换UI -> 触发更新
2. 回调触发更新（低优先级） -> 先显示旧的UI -> 等待新的UI任务加载完成后，再显示新的UI

如下例子中，但我们点击调用`selectTab`函数时，会触发`startTransition`函数，传入一个回调函数。
```javascript
const [isPending, startTransition] = useTransition();
const [tab, setTab] = useState("about");
const [number, setNumber] = useState("about");

function selectTab(nextTab) {
  startTransition(() => {
    setTab(nextTab);
    setNumber(1)
  });
}
```
整个流程类似这种：



