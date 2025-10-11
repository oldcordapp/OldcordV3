import Changelog from "./views/settings/modals/changelog";
import PluginInfo from "./views/settings/modals/pluginInfo";
import RemoveChunkCache from "./views/settings/modals/removeChunkCache";
import BuildConfirmation from "./views/selector/modals/buildConfirmation";
import EnvironmentWarning from "./views/selector/modals/environmentWarning";
import LegalAgreement from "./views/selector/modals/legalAgreement";
import OpfsComingSoon from "./views/selector/modals/opfsComingSoon";
import SubmitReport from "./views/selector/modals/submitReport";

export default {
  changelog: {
    Component: Changelog,
  },
  pluginInfo: {
    Component: PluginInfo,
  },
  removeChunkCache: {
    Component: RemoveChunkCache,
  },
  buildConfirmation: {
    Component: BuildConfirmation,
  },
  environmentWarning: {
    Component: EnvironmentWarning,
  },
  legalAgreement: {
    Component: LegalAgreement,
  },
  opfsComingSoon: {
    Component: OpfsComingSoon,
  },
  submitReport: {
    Component: SubmitReport
  },
};
