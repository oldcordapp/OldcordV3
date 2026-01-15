import { useState } from 'react';

import NavigationList from '@oldcord/frontend-shared/components/navigationList';
import { Text } from '@oldcord/frontend-shared/components/textComponent';
import { useUnsavedChanges } from '@oldcord/frontend-shared/hooks/unsavedChangesHandler';

import ViewHandler from '../../../hooks/viewHandler';
import getUserAgent from '../../../lib/getUserAgent';
import Changelog from './modals/changelog';

export const SETTINGS_VIEWS = {
  INFO: 'info',
  OLDPLUNGER_SETTINGS: 'oldplunger_settings',
  PLUGINS_AND_PATCHES: 'plugins_and_patches',
  THEMES: 'themes',
  DOWNLOAD_QUEUE: 'download_queue',
  OPFS_SETTINGS: 'opfs_settings',
  CHANGELOG: 'changelog',
  REPORT_CONTENT: 'report_content',
  DEVELOPER_PORTAL: 'developer_portal',
  ADVANCED_SETTINGS: 'advanced_settings',
};

const { Provider, useContextHook } = ViewHandler({
  views: SETTINGS_VIEWS,
  defaultView: SETTINGS_VIEWS.INFO,
});

export default function () {
  const { activeView, changeView } = useContextHook();
  const { hasUnsavedChanges, triggerNudge } = useUnsavedChanges();
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const navItems = [
    { type: 'header', label: 'Oldplunger' },
    { type: 'item', label: 'Transition Info', view: SETTINGS_VIEWS.INFO },
    {
      type: 'item',
      label: 'Oldplunger Settings',
      view: SETTINGS_VIEWS.OLDPLUNGER_SETTINGS,
    },
    {
      type: 'item',
      label: 'Plugins & Patches',
      view: SETTINGS_VIEWS.PLUGINS_AND_PATCHES,
    },
    { type: 'item', label: 'Themes', view: SETTINGS_VIEWS.THEMES },
    { type: 'separator' },
    { type: 'header', label: 'OPFS' },
    {
      type: 'item',
      label: 'Download Queue',
      view: SETTINGS_VIEWS.DOWNLOAD_QUEUE,
    },
    {
      type: 'item',
      label: 'OPFS Settings',
      view: SETTINGS_VIEWS.OPFS_SETTINGS,
    },
    { type: 'separator' },
    { type: 'header', label: 'Instance' },
    {
      type: 'openUrl',
      label: 'Developer Portal',
      onClick: () => {
        window.open('/developers');
      },
    },
    {
      type: 'item',
      label: 'Report Content',
      view: SETTINGS_VIEWS.REPORT_CONTENT,
    },
    { type: 'separator' },
    { type: 'header', label: 'Oldcord' },
    {
      type: 'openModal',
      label: 'Changelog',
      view: SETTINGS_VIEWS.CHANGELOG,
      onClick: () => {
        setIsChangelogOpen(true);
      },
    },
    {
      type: 'item',
      label: 'Advanced Settings',
      view: SETTINGS_VIEWS.ADVANCED_SETTINGS,
    },
  ];

  function handleItemClick(view) {
    if (hasUnsavedChanges) {
      triggerNudge();
      return;
    }
    changeView(view);
  }

  return (
    <>
      <NavigationList navItems={navItems} activeView={activeView} onItemClick={handleItemClick} />
      <div style={{ padding: '8px 10px' }}>
        <Text
          variant="body"
          style={{
            fontSize: '12px',
            fontWeight: '400',
            lineHeight: '1.333',
            color: '#72767d',
            marginTop: '0',
          }}
        >
          Oldcord {import.meta.env.VITE_APP_GIT_COMMIT_HASH}
          <br />
          {getUserAgent()}
        </Text>
      </div>
      <Changelog isOpen={isChangelogOpen} onClose={() => setIsChangelogOpen(false)} />
    </>
  );
}

export const SettingsViewHandler = Provider;
export const useSettings = useContextHook;
