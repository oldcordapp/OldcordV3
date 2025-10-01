import { useEffect, useRef } from "react";
import { useLayer } from "../../hooks/layerHandler";
import SettingsView from "../views/settings/main";
import "./secondaryLayer.css";

export default function () {
  const { activeLayer, exitingLayer } = useLayer();
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

  return (
    <div className={`secondary-layer`} ref={ref}>
      <div className="sidebar"></div>

      {(activeLayer === "settings" || exitingLayer === "settings") && (
        <SettingsView></SettingsView>
      )}
    </div>
  );
}
