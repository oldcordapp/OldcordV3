import "./settingsButton.css";
import Gear from "@oldcord/frontend-shared/assets/gear.svg?react";
import { useLayer } from "../../../hooks/layerHandler";
import Button from "@oldcord/frontend-shared/components/button";

export default function () {
  const { changeLayer } = useLayer();

  function switchView() {
    changeLayer("settings");
  }

  return (
    <Button onClick={switchView}>
      <Gear className="gear-icon"/>
    </Button>
  );
}
