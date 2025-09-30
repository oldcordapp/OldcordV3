// import "./secondaryLayer.css";
import { useLayer } from "../../hooks/layerHandler";

export default function () {
  const isActive = useLayer().activeLayer !== null;

  return (
    <div
      className={`secondary-layer ${isActive ? "enter" : "exit"}`}
    ></div>
  );
}
