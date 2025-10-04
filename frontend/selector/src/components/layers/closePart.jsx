import { useEffect, useCallback } from "react";
import "./closePart.css";
import Xmark from "@oldcord/frontend-shared/assets/xmark.svg?react";
import { useModal } from "@oldcord/frontend-shared/hooks/modalHandler";

export default function ({ onClose }) {
  const { activeModal, exitingModal } = useModal();

  const handleClose = useCallback(() => {
    if (!activeModal && !exitingModal) {
      onClose();
    }
  }, [activeModal, exitingModal, onClose]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleClose]);

  return (
    <div>
      <div className="close-button-container">
        <button className="close-button" onClick={handleClose}>
          <Xmark className="x-mark" />
        </button>
        <div className="keybind-hint">ESC</div>
      </div>
    </div>
  );
}
