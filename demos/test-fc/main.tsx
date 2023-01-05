import { useState } from "react";
import ReactDOM from "react-dom/client";
function App() {
  const [num, setNum] = useState(100);
  window.setNum = setNum;
  return num === 3 ? <Hello /> : <div>{num}</div>;
}

function Hello() {
  return <div>Hello World</div>;
}
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
