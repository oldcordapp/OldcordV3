import NavigationList from "@oldcord/frontend-shared/components/navigationList";
import ViewHandler from "../../../hooks/viewHandler";

export const SETTINGS_VIEWS = {
  INFO: "info",
  OLDPLUNGER_SETTINGS: "oldplunger_settings",
  PLUGINS_AND_PATCHES: "plugins_and_patches",
  THEMES: "themes",
  DOWNLOAD_QUEUE: "download_queue",
  OPFS_SETTINGS: "opfs_settings",
  CHANGELOG: "changelog",
  ADVANCED_SETTINGS: "advanced_settings",
};

const { Provider, useContextHook } = ViewHandler({
  views: SETTINGS_VIEWS,
  defaultView: SETTINGS_VIEWS.INFO,
});

export default function () {
  const { activeView, changeView } = useContextHook();

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
        console.log("[Selector] Modal not implemented!");
      },
    },
    {
      type: "item",
      label: "Advanced Settings",
      view: SETTINGS_VIEWS.ADVANCED_SETTINGS,
    },
  ];

  return (
    <NavigationList
      navItems={navItems}
      activeView={activeView}
      onItemClick={changeView}
    />
  );
}

export const SettingsViewHandler = Provider;
export const useSettings = useContextHook;
