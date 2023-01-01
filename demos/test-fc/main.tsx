import React from "react";
import ReactDOM from "react-dom/client";
function App() {
  return <Hello name="yx" />;
}

function Hello(props) {
  return <div>Hello World</div>;
}
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
