import "./primaryLayer.css";
import { useLayer } from "../../hooks/layerHandler";
import useIsMounted from "../../hooks/useIsMounted";
import Selector from "../views/selector/main";

export default function () {
  const isActive = useLayer().activeLayer === null;
  const isMounted = useIsMounted();

  return (
    <div
      className={`primary-layer ${
        isActive ? (isMounted ? "enter" : "") : "exit"
      }`}
    >
      <Selector />
    </div>
  );
}
