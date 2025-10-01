import { LayerHandler, useLayer } from "./hooks/layerHandler";
import "./App.css";
import PrimaryLayer from "./components/layers/primaryLayer";
import SecondaryLayer from "./components/layers/secondaryLayer";
import ModalsLayer from "./components/layers/modalsLayer";

function Container() {
  const { activeLayer, exitingLayer } = useLayer();

  return (
    <>
      <PrimaryLayer />
      {(activeLayer !== null || exitingLayer !== null) && <SecondaryLayer />}

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
