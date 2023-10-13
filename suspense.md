
# Suspense的介绍和原理

## Suspense介绍
suspense是`React 16.6`新出的一个功能，用于异步加载组件，可以让组件在等待异步加载的时候，渲染一些fallback的内容，让用户有更好的体验。

这一章节可以让我们了解基本的`Suspense`的实现原理。

## Suspense的基本使用
### 1. 异步加载组件
下面我们使用`lazy`加载`OtherComponent`组件，当组件数据加载完成后，渲染`OtherComponent`组件，如果加载过程中，我们可以渲染`Loading...`的内容。
```js
const OtherComponent = React.lazy(() => import('./OtherComponent'));

function App() {
    return (
        <div>
        <Suspense fallback={<div>Loading...</div>}>
            <OtherComponent />
        </Suspense>
        </div>
    );
}        
```
由于`OtherComponent`组件中，数据需要异步加载，所以在数据加载完成之前，我们需要一个界面去表示正在加载数据的过程，这个界面就是`fallback`。


## Suspense的原理
在了解实现原理之前，首先来看看，我们需要实现的例子内容。

正常情况下，`React`会有很多场景使用到`Suspense`，我们不可能全部都实现。比如：
1. `Razy`组件懒加载
2. `transition fallback`等
3. `use`的hook

在[新版的`React`文档](https://react.dev/reference/react/Suspense)中的一些`demo`是通过`use`hook实现的，由于我们之前已经实现了`hook`的逻辑部分。所以我们就实现一下如下demo的原理。

```javascript
function App() {
  const [num, setNum] = useState(0);
  return (
    <div>
      <button onClick={() => setNum(num + 1)}>change id: {num}</button>
      <Suspense fallback={<div>loading...</div>}>
        <Cpn id={num} timeout={2000} />
      </Suspense>
    </div>
  );
}

export function Cpn({ id, timeout }) {
  const [num, updateNum] = useState(0);
  const { data } = use(fetchData(id, timeout));

  if (num !== 0 && num % 5 === 0) {
    cachePool[id] = null;
  }
  return (
    <ul onClick={() => updateNum(num + 1)}>
      <li>ID: {id}</li>
      <li>随机数: {data}</li>
      <li>状态: {num}</li>
    </ul>
  );
}
```
这里列举了`App`和`Cpn`2个部分内容，我们要实现子组件使用`use`包裹一个`Promise`的请求，然后被挂起，展示`fallback`的内容，等待请求完成后，再渲染子组件。

### suspense的细节
在我们平时使用`suspense`的时候，有一些细节方面，不晓得大家有没有注意到。

1. 首次渲染的时候，`React`在请求回到之前是直接渲染`fallback`中的内容。并不会渲染子组件的内容。下面一段话，来自官方文档，在请求返回之前，子组件不会有任何状态被保存。
> React does not preserve any state for renders that got suspended before they were able to mount for the first time.
> When the component has loaded, React will retry rendering the suspended tree from scratch.
2. 渲染子组件后，如果我们再次`loading`中，渲染后的子组件并不会被销毁，而是通过`css`样式隐藏。
   ![image.png](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/80c7c741fd264b448e153435afb039a3~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1190&h=212&s=30291&e=png&b=fdfdfd)
3. 当子组件再次渲染的时候，它原来的状态是可以保留的。比如上面的例子，我们点击`change id`按钮，虽然重新渲染了，但是子组件的`num`状态是保留的, 一直都是数字8。
   ![QQ录屏20230918171056.gif](https://p6-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d6d4aca7af85436dacde23315408244e~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1066&h=198&s=277103&e=gif&f=250&b=fbfaf7)

如果我们按照正常的一个`Child`组件来实现的话。在挂起的时候渲染`fallback`, 在正常的时候渲染`Cpn`组件。这样的话，不能满足我们的第二、第三点。

![一个child模式.png](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/148cc7b3545147f0b5e9946ff3c9f998~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=847&h=452&s=39599&e=png&b=121212)

它不能够保存状态，所以不适合我们的`Suspense`实现。

### suspense的fiber结构
为了保留相应的状态，实现`css`控制隐藏元素，我们肯定是需要把`fallback`和`子组件cpn`都渲染到`fiber`树上的。这样我们就可以通过`css`样式来控制隐藏和显示。

同时也可以保存状态。所以如果只有一个`Child-fiber`是肯定不行的。

`react`中是如下的结构来标识`suspense`的`fiber tree`。

![新的内容.png](https://p1-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9a22f3d10da2440cb426f420482ebe1d~tplv-k3u1fbpfcp-jj-mark:0:0:0:0:q75.image#?w=1158&h=697&s=73639&e=png&b=111111)

新增了一种类型`Offscreen`, 用于标识真正的子元素的显示和隐藏。整体流程类似这样

1. 初始化渲染的时候，由于`children`组件的数据没有返回，所以`Offscreen`将`mode`设置为`hidden`
2. 通过`sibling`渲染`Fragment`的结构。当数据返回后，再次开始调度，重新渲染`Offscreen`。
3. 如果发生更新行为，会再次走挂起流程，等待数据返回后，再次更新内容。

所以我们需要分4种情况进行处理：
* 初始化(`mount`)
    1. 挂起流程 `mountSuspenseFallbackChildren`
    2. 正常流程 `mountSuspensePrimaryChildren`

* 更新(`update`)
    1. 挂起流程 `updateSuspenseFallbackChildren`
    2. 正常流程 `updateSuspensePrimaryChildren`

### beginWork流程

