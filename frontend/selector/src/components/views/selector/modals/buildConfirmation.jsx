import { useEffect, useState } from 'react';

import Button from '@oldcord/frontend-shared/components/button';
import InfoCard from '@oldcord/frontend-shared/components/infoCard';
import Modal from '@oldcord/frontend-shared/components/modal';
import { Text } from '@oldcord/frontend-shared/components/textComponent';

import { PATCHES } from '../../../../constants/patches';
import { useOldplugerPlugins } from '../../../../hooks/oldplungerPluginsHandler';
import cookieManager from '../../../../lib/cookieManager';

export default function ({ isOpen, onClose, onConfirm, selectedBuild, enabledPlugins }) {
  const [displayedBuild, setDisplayedBuild] = useState(selectedBuild);
  const [displayedPlugins, setDisplayedPlugins] = useState(enabledPlugins);
  const { plugins } = useOldplugerPlugins();

  const oldplungerEnabled = cookieManager.get('oldplunger_enabled');

  useEffect(() => {
    if (selectedBuild) {
      setDisplayedBuild(selectedBuild);
    }
    if (enabledPlugins) {
      setDisplayedPlugins(enabledPlugins);
    }
  }, [selectedBuild, enabledPlugins]);

  if (!displayedBuild) {
    return null;
  }
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title='Build Confirmation'
      showCloseButton={false}
      size='small'
      footerAlignment='right'
      footer={
        <>
          <Button variant='ghost' onClick={() => onClose(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm()}>Launch</Button>
        </>
      }
    >
      <div style={{ paddingBottom: '20px' }}>
        <Text variant='body'>Selected Build: {displayedBuild}</Text>
        {oldplungerEnabled !== 'true' &&
          displayedPlugins &&
          displayedPlugins.legacy &&
          displayedPlugins.legacy.length > 0 && (
            <>
              <Text variant='body' style={{ marginTop: '16px' }}>
                Enabled legacy patches:
              </Text>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                {displayedPlugins.legacy.map((plugin, index) => (
                  <li key={index} style={{ margin: '4px 0' }}>
                    <Text variant='body'>{PATCHES[plugin].name}</Text>
                  </li>
                ))}
              </ul>
            </>
          )}
        {oldplungerEnabled === 'true' &&
          displayedPlugins &&
          displayedPlugins.oldplunger &&
          displayedPlugins.oldplunger.length > 0 && (
            <>
              <Text variant='body' style={{ marginTop: '16px' }}>
                Enabled plugins:
              </Text>
              <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                {displayedPlugins.oldplunger.map((plugin, index) => (
                  <li key={index} style={{ margin: '4px 0' }}>
                    <Text variant='body'>{plugins[plugin].name}</Text>
                  </li>
                ))}
              </ul>
            </>
          )}
        {oldplungerEnabled === 'true' && (
          <InfoCard style={{ marginTop: '20px', marginBottom: '0' }}>
            Oldplunger is enabled! Oldplunger is Discord mod that replaces the legacy patching
            system. As such, old patches will not be applied.
          </InfoCard>
        )}
      </div>
    </Modal>
  );
}
