import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

function App() {
  const [isDel, del] = useState(false);
  const [_, forceUpdate] = useState((x: any) => x + 1);
  const divRef = useRef(null);
  const ref = useRef({
    count: 1,
  });

  console.warn("render divRef", divRef.current, ref.current);

  useEffect(() => {
    console.warn("useEffect divRef", divRef.current);
  }, []);

  return (
    // @ts-ignore
    <div ref={divRef} onClick={() => del(true)}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          ref.current.count++;
          forceUpdate(1);
          console.log("-hcc-click");
        }}
      >
        hcc - {ref.current.count}
      </div>
      {isDel ? null : <Child />}
    </div>
  );
}

function Child() {
  return <p ref={(dom) => console.warn("dom is:", dom)}>Child</p>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
