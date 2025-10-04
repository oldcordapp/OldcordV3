import ToggleSwitch from "./toggleSwitch";
import Gear from "../assets/gear.svg?react";
import Info from "../assets/info.svg?react";
import "./optionsCard.css";
import { useId } from "react";

export default function ({
  title,
  description,
  iconType,
  isEnabled,
  onToggle,
}) {
  const uniqueId = useId();
  let disabled = false;

  function renderIcon() {
    switch (iconType) {
      case "settings":
        return (
          <button className="icon-button">
            <Gear />
          </button>
        );
      case "info":
        return (
          <button className="icon-button">
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
        <p className="description">{description}</p>
      </div>
      <div className="controls">
        {renderIcon()}
        <ToggleSwitch
          isChecked={isEnabled}
          onChange={onToggle}
          uniqueId={uniqueId}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
