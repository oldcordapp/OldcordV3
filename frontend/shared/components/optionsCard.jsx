import ToggleSwitch from "./toggleSwitch";
import Gear from "../assets/gear.svg?react";
import Info from "../assets/info.svg?react";
import "./optionsCard.css"
import { useId } from "react";

export default function ({
  title,
  description,
  iconType,
  isEnabled,
  onToggle,
}) {
  const uniqueId = useId();

  function renderIcon() {
    switch (iconType) {
      case "settings":
        return (
          <button className="icon-button" aria-label="Settings">
            <Gear />
          </button>
        );
      case "info":
        return (
          <button className="icon-button" aria-label="Information">
            <Info />
          </button>
        );
    }
  }

  return (
    <div className="options-card">
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
        />
      </div>
    </div>
  );
}
