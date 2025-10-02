import { useId } from "react";
import "./toggleSettings.css";

export default function ({ title, description, isChecked, onChange }) {
  const uniqueId = useId();

  return (
    <div className="toggle-setting-container">
      <div className="setting-row">
        <div className="setting-label-wrapper">
          <label htmlFor={uniqueId} className="setting-title">
            {title}
          </label>
        </div>

        <div
          className={`toggle-switch ${isChecked ? "checked" : ""}`}
          tabIndex={0}
          onClick={onChange}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange()}
        >
          <input
            id={uniqueId}
            className="toggle-checkbox"
            type="checkbox"
            checked={isChecked}
            onChange={onChange}
            tabIndex={-1}
          />
        </div>
      </div>

      <div className="setting-description">{description}</div>
    </div>
  );
}
