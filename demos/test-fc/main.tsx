import { useState } from "react";
import ReactDOM from "react-dom/client";
function App() {
  const [num, setNum] = useState(100);
  window.setNum = setNum;
  return <div>{num}</div>;
}

// function Hello(props) {
//   return <div>Hello World</div>;
// }
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
