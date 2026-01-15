import Gear from '@oldcord/frontend-shared/assets/gear.svg?react';
import Button from '@oldcord/frontend-shared/components/button';

import { useLayer } from '../../../hooks/layerHandler';

import './settingsButton.css';

export default function () {
  const { changeLayer } = useLayer();

  function switchView() {
    changeLayer('settings');
  }

  return (
    <Button onClick={switchView}>
      <Gear className="gear-icon" />
    </Button>
  );
}
