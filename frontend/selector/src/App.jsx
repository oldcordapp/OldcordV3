import { LayerHandler, useLayer } from "./hooks/layerHandler";
import "./App.css";
import PrimaryLayer from "./components/layers/primaryLayer";
import SecondaryLayer from "./components/layers/secondaryLayer";
import ModalsLayer from "./components/layers/modalsLayer";

function Container() {
  const { activeLayer } = useLayer();

  return (
    <>
      <PrimaryLayer />
      {activeLayer === "settings" && <SecondaryLayer />}

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
