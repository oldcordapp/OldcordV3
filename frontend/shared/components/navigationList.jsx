import './navigationList.css';

import { useState } from 'react';

export default function ({ navItems, activeView, onItemClick }) {
  const [clickingIndex, setClickingIndex] = useState(null);

  const handleOpenUrlClick = (item, index) => {
    setClickingIndex(index);

    setTimeout(() => {
      setClickingIndex(null);

      item.onClick();
    }, 50);
  };

  return (
    <div className="nav-list">
      {navItems.map((item, index) => {
        switch (item.type) {
          case 'header':
            return (
              <div key={index} className="nav-header">
                {item.label}
              </div>
            );
          case 'openModal':
            return (
              <div key={index} className={`nav-item`} onClick={() => item.onClick()}>
                {item.label}
              </div>
            );
          case 'openUrl':
            return (
              <div
                key={index}
                className={`nav-item ${clickingIndex === index ? 'selected' : ''}`}
                onClick={() => handleOpenUrlClick(item, index)}
              >
                {item.label}
              </div>
            );
          case 'item':
            return (
              <div
                key={index}
                className={`nav-item ${activeView === item.view ? 'selected' : ''}`}
                onClick={() => onItemClick(item.view)}
              >
                {item.label}
              </div>
            );
          case 'separator':
            return <div key={index} className="nav-separator" />;
        }
      })}
    </div>
  );
}
