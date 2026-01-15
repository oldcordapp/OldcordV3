import SecondaryLayer from './layers/secondaryLayer';
import SettingsView from './views/settings/main';
import SettingsNavigationList, {
  SettingsViewHandler,
} from './views/settings/settingsNavigationList';

export default {
  settings: {
    Component: () => (
      <SettingsViewHandler>
        <SecondaryLayer
          sidebarComponent={<SettingsNavigationList />}
          contentComponent={<SettingsView />}
        />
      </SettingsViewHandler>
    ),
  },
};
