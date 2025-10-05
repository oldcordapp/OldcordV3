import { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import "./modal.css";
import Xmark from "../assets/xmark.svg?react";
import { useModal } from "../hooks/modalHandler";

export default function ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "medium",
  showCloseButton = false,
  footerAlignment = "right",
  style
}) {
  const ref = useRef();
  const { exitingModal } = useModal();

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscapeKey);
    }
    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current) {
        ref.current.classList.add("open");
      }
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ref.current && exitingModal) {
      ref.current.classList.remove("open");
    }
  }, [exitingModal]);

  const modalLayer =
    document.querySelector(".modal-layer") || document.createElement("div");
  if (!document.querySelector(".modal-layer")) {
    modalLayer.className = "modal-layer";
    document.body.appendChild(modalLayer);
  }

  const sizeClass = `modal-content ${size}`;

  return ReactDOM.createPortal(
    <div className="modal-container" ref={ref}>
      <div className="modal-backdrop" onClick={onClose}></div>
      <div className="modal-root">
        <div className={`modal-content ${sizeClass}`} style={style}>
          {(title || showCloseButton) && (
            <div className="modal-header">
              <div className="modal-header-text">
                {title && <h4 className="modal-title">{title}</h4>}
                {subtitle && <div className="modal-subtitle">{subtitle}</div>}
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  className="modal-close-button"
                  onClick={onClose}
                >
                  <Xmark />
                </button>
              )}
            </div>
          )}

          <div className="scroller-wrapper">
            <div className="scroller">{children}</div>
          </div>

          {footer && <div className={`modal-footer ${footerAlignment === "left" ? "footer-left" : "footer-right"}`}>{footer}</div>}
        </div>
      </div>
    </div>,
    modalLayer
  );
}
