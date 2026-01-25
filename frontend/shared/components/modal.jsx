import { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { CSSTransition } from 'react-transition-group';

import Xmark from '../assets/xmark.svg?react';

import './modal.css';

export default function ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'medium',
  showCloseButton = false,
  footerAlignment = 'right',
  style,
}) {
  const ref = useRef(null);
  const [inProp, setInProp] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setInProp(true), 10);
      return () => clearTimeout(timer);
    } else {
      setInProp(false);
    }
  }, [isOpen]);

  const handleModalClose = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape' && inProp) {
        event.stopPropagation();
        handleModalClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey, true);

    return () => {
      document.removeEventListener('keydown', handleEscapeKey, true);
    };
  }, [inProp, handleModalClose]);

  const modalLayer = document.querySelector('.modal-layer') || document.createElement('div');
  if (!document.querySelector('.modal-layer')) {
    modalLayer.className = 'modal-layer';
    document.body.appendChild(modalLayer);
  }

  const sizeClass = `modal-content ${size}`;

  return ReactDOM.createPortal(
    <CSSTransition nodeRef={ref} in={inProp} timeout={300} classNames='modal' unmountOnExit>
      <div className='modal-container' ref={ref}>
        <div className='modal-backdrop' onClick={handleModalClose}></div>
        <div className='modal-root'>
          <div className={`modal-content ${sizeClass}`} style={style}>
            {(title || showCloseButton) && (
              <div className='modal-header'>
                <div className='modal-header-text'>
                  {title && <h4 className='modal-title'>{title}</h4>}
                  {subtitle && <div className='modal-subtitle'>{subtitle}</div>}
                </div>
                {showCloseButton && (
                  <button type='button' className='modal-close-button' onClick={handleModalClose}>
                    <Xmark />
                  </button>
                )}
              </div>
            )}

            <div className='scroller-wrapper'>
              <div className='scroller'>{children}</div>
            </div>

            {footer && (
              <div
                className={`modal-footer ${
                  footerAlignment === 'left' ? 'footer-left' : 'footer-right'
                }`}
              >
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </CSSTransition>,
    modalLayer,
  );
}
