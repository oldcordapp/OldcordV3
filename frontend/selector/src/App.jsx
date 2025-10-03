import { LayerHandler, useLayer } from "./hooks/layerHandler";
import "./App.css";
import PrimaryLayer from "./components/layers/primaryLayer";
import SecondaryLayer from "./components/layers/secondaryLayer";
import ModalsLayer from "./components/layers/modalsLayer";

import SettingsNavigationList, {
  SettingsViewHandler,
} from "./components/views/settings/settingsNavigationList";
import SettingsView from "./components/views/settings/main";
import {
  UnsavedChangesHandler,
  useUnsavedChanges,
} from "@oldcord/frontend-shared/hooks/unsavedChangesHandler";
import { useEffect, useRef } from "react";

function Container() {
  const { activeLayer, exitingLayer } = useLayer();
  const { isNudging, displayRedNotice } = useUnsavedChanges();
  const ref = useRef(null);

  useEffect(() => {
    let intervalId;

    if (isNudging) {
      intervalId = setInterval(() => {
        if (ref.current) {
          const randomY = Math.random() * 30 - 15;
          const randomX = Math.random() < 0.5 ? 15 : -15;

          ref.current.style.transform = `translate3d(${randomX}px, ${randomY}px, 0)`;
        }
      }, 10);
    } else {
      if (ref.current) {
        ref.current.style.transform = "";
      }
    }

    return () => {
      clearInterval(intervalId);
    };
  }, [isNudging]);

  let layerContent = null;

  if (activeLayer === "settings" || exitingLayer === "settings") {
    layerContent = (
      <SettingsViewHandler>
        <SecondaryLayer
          sidebarComponent={<SettingsNavigationList />}
          contentComponent={<SettingsView />}
        />
      </SettingsViewHandler>
    );
  }

  return (
    <div ref={ref}>
      <PrimaryLayer />
      {layerContent}

      <ModalsLayer />
    </div>
  );
}

export default function () {
  return (
    <LayerHandler>
      <UnsavedChangesHandler>
        <Container />
      </UnsavedChangesHandler>
    </LayerHandler>
  );
}
