import ToggleSwitch from "./toggleSwitch";
import Gear from "../assets/gear.svg?react";
import Info from "../assets/info.svg?react";
import "./optionsCard.css";
import { useState } from "react";
import PluginInfo from "../../selector/src/components/views/settings/modals/pluginInfo";

export default function ({
  cardId,
  pluginType,
  title,
  description,
  iconType,
  isEnabled,
  onToggle,
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  let disabled = false;

  function renderIcon() {
    switch (iconType) {
      case "settings":
        return (
          <button className="icon-button" onClick={() => setIsModalOpen(true)}>
            <Gear />
          </button>
        );
      case "info":
        return (
          <button className="icon-button" onClick={() => setIsModalOpen(true)}>
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
    <>
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
      <PluginInfo
        isOpen={isModalOpen}
        plugin={cardId}
        type={pluginType}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
