import SecondaryLayer from './layers/secondaryLayer';
import SettingsNavigationList, {
  SettingsViewHandler,
} from './views/settings/settingsNavigationList';
import SettingsView from './views/settings/main';

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
