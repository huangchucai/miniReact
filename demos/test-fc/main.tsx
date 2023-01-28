import { useState, Fragment } from "react";
import ReactDOM from "react-dom/client";

console.log(Fragment);

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
  const [num, setNum] = useState(101);
  // let arr = [<li>c</li>, <li>d</li>];
  // return (
  //   <ul>
  //     <li>a</li>
  //     <li>b</li>
  //     {arr}
  //   </ul>
  // );
  // return (
  //   <div>
  //     <p>1</p>
  //   </div>
  // );
  // return <ul onClickCapture={() => setNum(num + 1)}>{arr}</ul>;
  return (
    <div
      onClick={() => {
        setNum(num + 1);
      }}
    >
      {num % 2 === 0 ? (
        <div>{num}</div>
      ) : (
        <Fragment key="11">
          <p>xxx</p>
          <p>yyy</p>
        </Fragment>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <App />
);
