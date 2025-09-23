import { QOL_PATCHES } from './config/patches.js';
import { Settings } from './modules/settings.js';
import { UI, Launcher } from './modules/ui.js';

function initializeEventListeners() {
    document.getElementById('buildSelect').addEventListener('change', () => {
        UI.updateContent();
    });

    document.getElementById('launchButton').addEventListener('click', () => {
        const selectedBuild = document.getElementById('buildSelect').value;

        const conflicts = Settings.getIncompatibilityReport(selectedBuild);
        if (conflicts.length > 0) {
            UI.showIncompatibilityDialog(conflicts);
            return;
        }

        const enabledMods = Object.entries(QOL_PATCHES)
            .filter(([_, patch]) => {
                const checkbox = document.getElementById(patch.id);
                return checkbox && checkbox.checked;
            })
            .map(([_, patch]) => patch.label);

        Launcher.showDialogs(selectedBuild, enabledMods);
    });

    document.getElementById('advancedSettingsButton').addEventListener('click', () => {
        UI.toggleAdvancedSettings(true);
    });

    document.getElementById('backToSelectorButton').addEventListener('click', () => {
        UI.toggleAdvancedSettings(false);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    requestAnimationFrame(() => {
        document.querySelector('.background').classList.add('loaded');
    });
    
    await Launcher.initialize();
    Settings.clearStorage();
    UI.initializeBuildSelect();
    initializeEventListeners();
    
});