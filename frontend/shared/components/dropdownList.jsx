import { useState, useRef, useEffect } from 'react';
import './dropdownList.css';

export default function ({ label, options, defaultOption }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(defaultOption || (options.length > 0 ? options[0] : ''));
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [wrapperRef]);
  
  const handleOptionClick = (option) => {
    setSelectedValue(option);
    setIsOpen(false);
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="list-container" ref={wrapperRef}>
      <label className="list-label">{label}</label>
      <button
        type="button"
        className={`list-button ${isOpen ? 'is-open' : ''}`}
        onClick={toggleDropdown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="list-button-label">{selectedValue}</span>
        <span className="list-arrow" />
      </button>

      {isOpen && (
        <ul className="list-dropdown" role="listbox">
          {options.map((option, index) => (
            <li
              key={index}
              className={`list-option ${selectedValue === option ? 'is-selected' : ''}`}
              onClick={() => handleOptionClick(option)}
              role="option"
              aria-selected={selectedValue === option}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
