import { useState } from 'react';

import InfoCard from '@oldcord/frontend-shared/components/infoCard';
import { Text } from '@oldcord/frontend-shared/components/textComponent';

import ToggleSetting from '../../../../components/shared/toggleSetting';
import cookieManager from '../../../../lib/cookieManager';

const oldplungerEnabledKey = 'oldplunger_enabled';

export default function () {
  const [oldplungerEnabled, setOldplungerEnabled] = useState(
    cookieManager.get(oldplungerEnabledKey) === 'true' ? true : false,
  );

  function enableOldplunger() {
    const newValue = !oldplungerEnabled;
    setOldplungerEnabled(newValue);
    cookieManager.set(oldplungerEnabledKey, newValue, { expires: 365 });
  }

  return (
    <>
      <Text variant='h2'>Oldplunger Settings</Text>
      <InfoCard title='Oldplunger Development Notice'>
        Oldplunger is in development!
        <br />
        All settings below will either be removed or changed upon release.
        <br />
        Please help us test Oldplunger!
      </InfoCard>
      <ToggleSetting
        title={'Enable Oldplunger'}
        description={'Enable the next generation of Oldcord modding. ! In development !'}
        isChecked={oldplungerEnabled}
        onChange={enableOldplunger}
      />
      <div className='divider' />
    </>
  );
}
