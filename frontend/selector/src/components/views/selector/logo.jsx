import { useState } from "react";
import Logo from "../../../assets/logo.svg?react";
import "./logo.css";

export default function () {
  const [isEntered, setIsEntered] = useState(false);

  function handleEntered() {
    setIsEntered(true);
  }

  return (
    <a
      href="https://oldcordapp.com"
      className={`logo-container ${isEntered ? "" : "enter"}`}
      onAnimationEnd={handleEntered}
    >
      <Logo className="logo-svg" />
    </a>
  );
}
