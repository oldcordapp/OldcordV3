import Button from '@oldcord/frontend-shared/components/button';
import { Text } from '@oldcord/frontend-shared/components/textComponent';
import { useState } from 'react';

import ToggleSetting from '../../../../components/shared/toggleSetting';
import cookieManager from '../../../../lib/cookieManager';
import RemoveChunkCache from '../modals/removeChunkCache';

const verboseModeKey = 'debug_mode';

export default function () {
  const [isRemoveChunkCacheModalOpen, setIsRemoveChunkCacheModalOpen] = useState(false);
  const [verboseMode, setVerboseMode] = useState(
    cookieManager.get(verboseModeKey) === 'true' ? true : false,
  );

  function enableVerboseMode() {
    const newValue = !verboseMode;
    setVerboseMode(newValue);
    cookieManager.set(verboseModeKey, newValue, { expires: 365 });
  }

  return (
    <>
      <Text variant="h2">Advanced Settings</Text>
      <ToggleSetting
        title={'Debug Mode'}
        description={
          'Allows easier debugging. Bootloader becomes more verbose, and Oldplunger plugins can be debugged more easily.'
        }
        isChecked={verboseMode}
        onChange={enableVerboseMode}
      />
      <div className="divider" />
      <Text variant="h2">Deprecated</Text>
      <Button
        style={{ width: '100%' }}
        onClick={() => {
          setIsRemoveChunkCacheModalOpen(true);
        }}
      >
        Remove stored failed chunk cache
      </Button>
      <RemoveChunkCache
        isOpen={isRemoveChunkCacheModalOpen}
        onClose={() => setIsRemoveChunkCacheModalOpen(false)}
      />
    </>
  );
}
