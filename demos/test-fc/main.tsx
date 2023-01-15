import { useState } from "react";
import ReactDOM from "react-dom/client";
/*function App() {
  const [num, setNum] = useState(3);
  // const [num1, setNum1] = useState(3);
  // const [num2, setNum2] = useState(3);
  // if (num === 4) {
  //   const [num3, setNum4] = useState(3);
  // }
  window.setNum = setNum;
  return (
    <div
      onClick={() => {
        console.log("container click");
      }}
      onClickCapture={() => {
        console.log("container onClickCapture");
      }}
    >
      <div
        onClick={() => {
          console.log("div click");
        }}
        onClickCapture={() => {
          console.log("div onClickCapture");
        }}
      >
        <p
          onClickCapture={() => {
            console.log("p onClickCapture");
          }}
          onClick={() => {
            console.log("p-click");
            setNum(num + 1);
          }}
        >
          {num}
        </p>
      </div>
    </div>
  );
}*/

function App() {
  const [num, setNum] = useState(100);
  const arr =
    num % 2 === 0
      ? [<li key="1">1</li>, <li key="2">2</li>, <li key="3">3</li>]
      : [<li key="3">3</li>, <li key="2">2</li>, <li key="1">1</li>];

  return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
