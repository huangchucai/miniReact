import { useState, useContext, createContext } from "react";

const ctx = createContext(0);

export default function App() {
  const [num, update] = useState(0);
  console.log("App render ", num);
  return (
    <ctx.Provider value={num}>
      <div
        onClick={() => {
          update(1);
        }}
      >
        <Cpn />
      </div>
    </ctx.Provider>
  );
}

const Cpn = function () {
  console.log("Cpn render");
  return (
    <div>
      <Child />
    </div>
  );
};

function Child() {
  console.log("Child render");
  const val = useContext(ctx);

  return <div>ctx: {val}</div>;
}
