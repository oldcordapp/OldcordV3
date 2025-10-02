import { useEffect, useRef } from "react";
import { useLayer } from "../../hooks/layerHandler";
import "./secondaryLayer.css";
import SidebarPart from "./sidebarPart";
import ClosePart from "./closePart";

export default function SecondaryLayer({ sidebarComponent, contentComponent }) {
  const { activeLayer, changeLayer } = useLayer();
  const isActive = activeLayer !== null;
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) {
      const timer = setTimeout(() => {
        ref.current.classList.add("transitionToSecondaryLayer");
      }, 0);

      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (ref.current && !isActive) {
      ref.current.classList.remove("transitionToSecondaryLayer");
    }
  }, [activeLayer]);

  function onClose() {
    changeLayer("primary");
  }

  return (
    <div className="secondary-layer" ref={ref}>
      <SidebarPart>{sidebarComponent}</SidebarPart>

      <div className="content-part">{contentComponent}</div>

      <ClosePart onClose={onClose} />
    </div>
  );
}
