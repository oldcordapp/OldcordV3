import { useRef } from 'react';
import { CSSTransition } from 'react-transition-group';

import Button from './button';

import './unsavedChangesNotice.css';

export default function ({
  show,
  onSave,
  onReset,
  displayRedNotice,
  message = 'Careful — you have unsaved changes!',
}) {
  const noticeRef = useRef(null);

  return (
    <CSSTransition
      in={show}
      nodeRef={noticeRef}
      timeout={300}
      classNames='notice-region'
      unmountOnExit
    >
      <div className='notice-region' ref={noticeRef}>
        <div className={`notice-container ${displayRedNotice ? 'red-notice' : ''}`}>
          <div className='notice-message'>{message}</div>
          <div className='button-group'>
            <Button variant='ghost' onClick={onReset}>
              Reset
            </Button>
            <Button variant='success' onClick={onSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </CSSTransition>
  );
}
