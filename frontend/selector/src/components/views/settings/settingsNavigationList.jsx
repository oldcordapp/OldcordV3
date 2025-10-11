import NavigationList from "@oldcord/frontend-shared/components/navigationList";
import ViewHandler from "../../../hooks/viewHandler";
import { useUnsavedChanges } from "@oldcord/frontend-shared/hooks/unsavedChangesHandler";
import { useModal } from "@oldcord/frontend-shared/hooks/modalHandler";

export const SETTINGS_VIEWS = {
  INFO: "info",
  OLDPLUNGER_SETTINGS: "oldplunger_settings",
  PLUGINS_AND_PATCHES: "plugins_and_patches",
  THEMES: "themes",
  DOWNLOAD_QUEUE: "download_queue",
  OPFS_SETTINGS: "opfs_settings",
  CHANGELOG: "changelog",
  REPORT_CONTENT: "report_content",
  ADVANCED_SETTINGS: "advanced_settings",
};

const { Provider, useContextHook } = ViewHandler({
  views: SETTINGS_VIEWS,
  defaultView: SETTINGS_VIEWS.INFO,
});

export default function () {
  const { activeView, changeView } = useContextHook();
  const { hasUnsavedChanges, triggerNudge } = useUnsavedChanges();
  const { addModal } = useModal();

  const navItems = [
    { type: "header", label: "Oldplunger" },
    { type: "item", label: "Transition Info", view: SETTINGS_VIEWS.INFO },
    {
      type: "item",
      label: "Oldplunger Settings",
      view: SETTINGS_VIEWS.OLDPLUNGER_SETTINGS,
    },
    {
      type: "item",
      label: "Plugins & Patches",
      view: SETTINGS_VIEWS.PLUGINS_AND_PATCHES,
    },
    { type: "item", label: "Themes", view: SETTINGS_VIEWS.THEMES },
    { type: "separator" },
    { type: "header", label: "OPFS" },
    {
      type: "item",
      label: "Download Queue",
      view: SETTINGS_VIEWS.DOWNLOAD_QUEUE,
    },
    {
      type: "item",
      label: "OPFS Settings",
      view: SETTINGS_VIEWS.OPFS_SETTINGS,
    },
    { type: "separator" },
    { type: "header", label: "Oldcord" },
    {
      type: "openModal",
      label: "Changelog",
      view: SETTINGS_VIEWS.CHANGELOG,
      onClick: () => {
        addModal("changelog");
      },
    },
    {
      type: "item",
      label: "Advanced Settings",
      view: SETTINGS_VIEWS.ADVANCED_SETTINGS,
    },
    { type: "separator" },
    { type: "header", label: "Instance Specific" },
    {
      type: "item",
      label: "Report Content",
      view: SETTINGS_VIEWS.REPORT_CONTENT
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
    <NavigationList
      navItems={navItems}
      activeView={activeView}
      onItemClick={handleItemClick}
    />
  );
}

export const SettingsViewHandler = Provider;
export const useSettings = useContextHook;
