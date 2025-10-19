import ToggleSwitch from "./toggleSwitch";
import Gear from "../assets/gear.svg?react";
import Info from "../assets/info.svg?react";
import "./optionsCard.css";
import { useModal } from "../hooks/modalHandler";

export default function ({
  cardId,
  pluginType,
  title,
  description,
  iconType,
  isEnabled,
  onToggle,
}) {
  const { addModal } = useModal();
  let disabled = false;

  function renderIcon() {
    switch (iconType) {
      case "settings":
        return (
          <button
            className="icon-button"
            onClick={() =>
              addModal("pluginInfo", { plugin: cardId, type: pluginType })
            }
          >
            <Gear />
          </button>
        );
      case "info":
        return (
          <button
            className="icon-button"
            onClick={() =>
              addModal("pluginInfo", { plugin: cardId, type: pluginType })
            }
          >
            <Info />
          </button>
        );
    }
  }

  if (isEnabled == "forcedEnabled") {
    isEnabled = true;
    disabled = true;
  } else if (isEnabled == "forcedDisabled") {
    isEnabled = false;
    disabled = true;
  }

  return (
    <div className={`options-card ${disabled ? "disabled" : ""}`}>
      <div className="content">
        <h3 className="title">{title}</h3>
        <p className="description" title={description}>
          {description}
        </p>
      </div>
      <div className="controls">
        {renderIcon()}
        <ToggleSwitch
          isChecked={isEnabled}
          onChange={onToggle}
          uniqueId={cardId}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
