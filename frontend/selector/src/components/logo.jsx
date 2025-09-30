import Logo from "../assets/logo.svg?react";
import useIsMounted from "../hooks/useIsMounted";

export default function () {
  const isMounted = useIsMounted();

  return (
    <a
      href="https://oldcordapp.com"
      className={`logo-container ${isMounted ? "" : "enter"}`}
    >
      <Logo className="logo-svg" />
    </a>
  );
}
