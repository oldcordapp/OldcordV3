import { useState, useEffect } from "react";
import "./UnsavedChangesNotice.css";

export default function ({
  show,
  onSave,
  onReset,
  displayRedNotice,
  message = "Careful — you have unsaved changes!",
  animationDuration = 300,
}) {
  const [animationState, setAnimationState] = useState("unmounted");

  useEffect(() => {
    let enterTimeout;
    let exitTimeout;

    if (show && animationState === "unmounted") {
      setAnimationState("entering");

      enterTimeout = setTimeout(() => {
        setAnimationState("entered");
      }, 10);
    } else if (
      !show &&
      (animationState === "entered" || animationState === "entering")
    ) {
      setAnimationState("exiting");

      exitTimeout = setTimeout(() => {
        setAnimationState("unmounted");
      }, animationDuration);
    }

    return () => {
      clearTimeout(enterTimeout);
      clearTimeout(exitTimeout);
    };
  }, [show, animationDuration]);

  if (animationState === "unmounted") {
    return null;
  }

  return (
    <div className={`notice-region ${animationState}`}>
      <div
        className={`notice-container ${displayRedNotice ? "red-notice" : ""}`}
      >
        <div className="notice-message">{message}</div>
        <div className="button-group">
          <button
            type="button"
            className="action-button reset"
            onClick={onReset}
          >
            Reset
          </button>
          <button type="button" className="action-button save" onClick={onSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
