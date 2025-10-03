import "./toggleSwitch.css";

export default function ({ isChecked, onChange, uniqueId }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange();
    }
  };

  return (
    <div
      className={`toggle-switch ${isChecked ? "checked" : ""}`}
      aria-checked={isChecked}
      tabIndex={0}
      onClick={onChange}
      onKeyDown={handleKeyDown}
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
  );
}
