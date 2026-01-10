import './toggleSetting.css';

import ToggleSwitch from '@oldcord/frontend-shared/components/toggleSwitch';
import { useId } from 'react';

export default function ({ title, description, isChecked, onChange }) {
  const uniqueId = useId();

  return (
    <div className="toggle-setting-container">
      <div className="setting-row">
        <div className="setting-label-wrapper">
          <label htmlFor={uniqueId} className="setting-title">
            {title}
          </label>
        </div>

        <ToggleSwitch isChecked={isChecked} onChange={onChange} uniqueId={uniqueId} />
      </div>

      <div className="setting-description">{description}</div>
    </div>
  );
}
