import "./main.css";
import { useSettings, SETTINGS_VIEWS } from "./settingsNavigationList";

import OldplungerInfo from "./pages/oldplungerInfo";
import OldplungerSettings from "./pages/oldplungerSettings";
import PluginsAndPatches from "./pages/pluginsAndPatches";
import Themes from "./pages/themes";
import DownloadQueue from "./pages/downloadQueue";
import OpfsSettings from "./pages/opfsSettings";
import AdvancedSettings from "./pages/advancedSettings";
import ReportContent from "./pages/reportContent";

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
        return <ReportContent />
    }
  }

  return <div className="settings-view-container">{renderContent()}</div>;
}
