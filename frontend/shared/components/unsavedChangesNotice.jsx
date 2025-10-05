import { useState, useEffect, useRef } from "react";
import "./unsavedChangesNotice.css";
import Button from "./button";

export default function ({
  show,
  onSave,
  onReset,
  displayRedNotice,
  message = "Careful — you have unsaved changes!",
  animationDuration = 300,
}) {
  const [shouldRender, setShouldRender] = useState(show);
  const noticeRef = useRef(null);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
    } else {
      if (noticeRef.current) {
        noticeRef.current.classList.remove("show");
      }
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, animationDuration);
      return () => clearTimeout(timer);
    }
  }, [show, animationDuration]);

  useEffect(() => {
    if (shouldRender) {
      const timer = setTimeout(() => {
        if (noticeRef.current) {
          noticeRef.current.classList.add("show");
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [shouldRender]);

  if (!shouldRender) {
    return null;
  }

  return (
    <div className="notice-region" ref={noticeRef}>
      <div
        className={`notice-container ${displayRedNotice ? "red-notice" : ""}`}
      >
        <div className="notice-message">{message}</div>
        <div className="button-group">
          <Button
            variant="ghost"
            onClick={onReset}
          >
            Reset
          </Button>
          <Button
            variant="success"
            onClick={onSave}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
