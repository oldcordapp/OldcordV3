import "./main.css";
import { useLayer } from "../../../hooks/layerHandler";

export default function () {
  const { changeLayer } = useLayer();

  function switchView() {
    changeLayer("primary");
  }

  return (
    <div className="settings-view-container">
      <p>Welcome to the settings page!</p>
      <button onClick={switchView}>Go back</button>
    </div>
  );
}
