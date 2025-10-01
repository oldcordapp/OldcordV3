import { useEffect, useRef } from "react";
import { useLayer } from "../../hooks/layerHandler";
import SettingsView from "../views/settings/main";
import "./secondaryLayer.css";
import SidebarPart from "./sidebarPart";
import SettingsNavigationList from "../views/settings/settingsNavigationList";
import ClosePart from "./closePart";

export default function () {
  const { activeLayer, exitingLayer, changeLayer } = useLayer();
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
    <div className={`secondary-layer`} ref={ref}>
      <SidebarPart>
        {(activeLayer === "settings" || exitingLayer === "settings") && (
          <SettingsNavigationList />
        )}
      </SidebarPart>

      <div className="content-part">
        {(activeLayer === "settings" || exitingLayer === "settings") && (
          <SettingsView></SettingsView>
        )}
      </div>

      <ClosePart onClose={onClose} />
    </div>
  );
}
