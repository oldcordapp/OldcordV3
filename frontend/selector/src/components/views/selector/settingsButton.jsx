import "./settingsButton.css";
import Gear from "../../../assets/gear.svg?react";
import { useLayer } from "../../../hooks/layerHandler";

export default function () {
  const { changeLayer } = useLayer();

  function switchView() {
    changeLayer("settings");
  }

  return (
    <button onClick={switchView}>
      <Gear className="gear-icon"/>
    </button>
  );
}
