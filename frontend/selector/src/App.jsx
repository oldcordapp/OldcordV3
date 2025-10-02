import { LayerHandler, useLayer } from "./hooks/layerHandler";
import "./App.css";
import PrimaryLayer from "./components/layers/primaryLayer";
import SecondaryLayer from "./components/layers/secondaryLayer";
import ModalsLayer from "./components/layers/modalsLayer";

import SettingsNavigationList, {
  SettingsViewHandler,
} from "./components/views/settings/settingsNavigationList";
import SettingsView from "./components/views/settings/main";

function Container() {
  const { activeLayer, exitingLayer } = useLayer();

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
    <>
      <PrimaryLayer />
      {layerContent}

      <ModalsLayer />
    </>
  );
}

export default function () {
  return (
    <LayerHandler>
      <Container />
    </LayerHandler>
  );
}
