import { useEffect } from "react";
import "./closePart.css";
import Xmark from "../../assets/xmark.svg?react";

export default function ({ onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div>
      <div className="close-button-container">
        <button className="close-button" onClick={onClose} aria-label="Close">
          <Xmark className="x-mark" />
        </button>
        <div className="keybind-hint">ESC</div>
      </div>
    </div>
  );
}
