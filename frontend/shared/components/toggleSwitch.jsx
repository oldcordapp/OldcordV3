import "./toggleSwitch.css";

export default function ({ isChecked, onChange, uniqueId, disabled = false }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange();
    }
  };

  return (
    <div
      className={`toggle-switch ${isChecked ? "checked" : ""}`}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={handleKeyDown}
    >
      <input
        id={uniqueId}
        className="toggle-checkbox"
        type="checkbox"
        checked={isChecked}
        readOnly
        tabIndex={-1}
        disabled={disabled}
      />
    </div>
  );
}
