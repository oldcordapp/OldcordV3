import "./main.css";
import { useSettings, SETTINGS_VIEWS } from "./settingsNavigationList";

import OldplungerInfo from "./oldplungerInfo";
import OldplungerSettings from "./oldplungerSettings";
import PluginsAndPatches from "./pluginsAndPatches";
import Themes from "./themes";
import DownloadQueue from "./downloadQueue";
import OpfsSettings from "./opfsSettings";
import AdvancedSettings from "./advancedSettings";

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
      case SETTINGS_VIEWS.CHANGELOG: {
      }
      case SETTINGS_VIEWS.ADVANCED_SETTINGS:
        return <AdvancedSettings />;
      default:
        return <OldplungerInfo />;
    }
  }

  return <div className="settings-view-container">{renderContent()}</div>;
}
