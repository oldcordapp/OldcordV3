import React, { useState } from 'react';

function InputMultiple({
  summary,
  fields,
  onCancel,
  cancelName,
  onComplete,
  completeName,
  showFieldSpan = true,
  fieldSeparatorGap = 25,
  minWidthForm = 300,
  minWidthInput = 300,
}) {
  const [inputValues, setInputValues] = useState({});

  const setInputValue = (name, value) => {
    setInputValues((prevValues) => ({
      ...prevValues,
      [name]: value,
    }));
  };

  const handleComplete = () => {
    onComplete(inputValues);
  };

  const isYesButtonDisabled = fields.some((field) => !inputValues[field.name]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="confirmation-modal-wrapper"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: minWidthForm }}
      >
        <div className="confirmation-modal">
          <div className="confirmation-modal-inner">
            <div className="confirmation-modal-inner-summary">{summary}</div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                marginTop: '20px',
              }}
            >
              {fields.map((field, i) => (
                <div
                  key={field.name}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: '100%',
                    marginTop: i > 0 ? `${fieldSeparatorGap}px` : '0px',
                  }}
                >
                  {showFieldSpan && (
                    <span
                      style={{
                        textAlign: 'left',
                        color: '#4f545c',
                        fontSize: '12px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        marginBottom: '5px',
                      }}
                    >
                      {field.name}
                    </span>
                  )}

                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    name={field.name}
                    value={inputValues[field.name] || ''}
                    onChange={(e) => setInputValue(field.name, e.target.value)}
                    min={field.minValue}
                    max={field.maxValue}
                    style={{
                      minWidth: minWidthInput,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="confirmation-modal-inner-buttons-wrapper">
              <button className="largeButton no-button" onClick={onCancel}>
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

export default InputMultiple;
