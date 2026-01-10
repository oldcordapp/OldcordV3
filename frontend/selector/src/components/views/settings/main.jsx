import './main.css';

import AdvancedSettings from './pages/advancedSettings';
import DownloadQueue from './pages/downloadQueue';
import OldplungerInfo from './pages/oldplungerInfo';
import OldplungerSettings from './pages/oldplungerSettings';
import OpfsSettings from './pages/opfsSettings';
import PluginsAndPatches from './pages/pluginsAndPatches';
import ReportContent from './pages/reportContent';
import Themes from './pages/themes';
import { SETTINGS_VIEWS, useSettings } from './settingsNavigationList';

export default function () {
  const { activeView } = useSettings();

  function renderContent() {
    switch (activeView) {
      case SETTINGS_VIEWS.INFO:
        return <OldplungerInfo />;
      case SETTINGS_VIEWS.OLDPLUNGER_SETTINGS:
        return <OldplungerSettings />;
      case SETTINGS_VIEWS.PLUGINS_AND_PATCHES:
        return <PluginsAndPatches />;
      case SETTINGS_VIEWS.THEMES:
        return <Themes />;
      case SETTINGS_VIEWS.DOWNLOAD_QUEUE:
        return <DownloadQueue />;
      case SETTINGS_VIEWS.OPFS_SETTINGS:
        return <OpfsSettings />;
      case SETTINGS_VIEWS.ADVANCED_SETTINGS:
        return <AdvancedSettings />;
      case SETTINGS_VIEWS.REPORT_CONTENT:
        return <ReportContent />;
    }
  }

  return <div className="settings-view-container">{renderContent()}</div>;
}
