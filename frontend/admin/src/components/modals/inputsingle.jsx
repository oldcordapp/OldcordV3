import React, { useState } from 'react';

function InputSingle({
  summary,
  fieldType,
  field,
  onCancel,
  cancelName,
  onComplete,
  completeName,
  showFieldSpan = true,
}) {
  const [inputValue, setInputValue] = useState('');

  const handleComplete = () => {
    onComplete(inputValue);
  };

  const isYesButtonDisabled = inputValue.trim() === '';

  return (
    <div className='modal-overlay' onClick={onCancel}>
      <div className='confirmation-modal-wrapper' onClick={(e) => e.stopPropagation()}>
        <div className='confirmation-modal'>
          <div className='confirmation-modal-inner'>
            <div className='confirmation-modal-inner-summary'>{summary}</div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                marginTop: '20px',
              }}
            >
              {showFieldSpan ? (
                <>
                  <span
                    style={{
                      textAlign: 'left',
                      color: '#4f545c',
                      fontSize: '12px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {field}
                  </span>
                </>
              ) : (
                <></>
              )}

              <input
                type={fieldType}
                placeholder={field}
                name={field}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
            </div>
            <div className='confirmation-modal-inner-buttons-wrapper'>
              <button className='largeButton no-button' onClick={onCancel}>
                <span>{cancelName}</span>
              </button>
              <button
                className={`largeButton yes-button ${isYesButtonDisabled ? 'disabled-btn' : ''}`}
                disabled={isYesButtonDisabled}
                onClick={handleComplete}
              >
                <span>{completeName}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InputSingle;
