import Background from "./background";
import Logo from "./logo";
import "./main.css";

export default function () {
  return (
    <>
      <Background />
      <Logo />
      <div className="selector-view"></div>
    </>
  );
}
