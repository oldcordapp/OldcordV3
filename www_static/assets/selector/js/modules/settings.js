import { QOL_PATCHES } from '../config/patches.js';

export const STORAGE_KEYS = {
    PATCH_PREFERENCES: 'patch_preferences',
    ENABLED_PATCHES: 'enabled_patches',
    RELEASE_DATE: 'release_date',
};

export class Settings {
    static setCookie(name, value, days = null) {
        let cookieString = `${name}=${JSON.stringify(value)};path=/;SameSite=Lax`;
        
        if (days !== null) {
            const expires = new Date();
            expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
            cookieString += `;expires=${expires.toUTCString()}`;
        }
        
        document.cookie = cookieString;
    }

    static getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            try {
                return JSON.parse(parts.pop().split(';').shift());
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    static isCompatibleBuild(patch, selectedBuild) {
        const { compatibleVersions } = patch;
        if (compatibleVersions === 'all') return true;
        if (Array.isArray(compatibleVersions)) return compatibleVersions.includes(selectedBuild);
        return selectedBuild.split('_')[2] === compatibleVersions;
    }

    static getBuildPreferences(selectedBuild) {
        const preferences = this.getCookie(STORAGE_KEYS.PATCH_PREFERENCES) || {};
        return preferences[selectedBuild] || {};
    }

    static saveBuildPreferences(selectedBuild, settings) {
        const preferences = this.getCookie(STORAGE_KEYS.PATCH_PREFERENCES) || {};
        preferences[selectedBuild] = settings;
        this.setCookie(STORAGE_KEYS.PATCH_PREFERENCES, preferences);
    }

    static updateEnabledPatches(selectedBuild) {
        const preferences = this.getBuildPreferences(selectedBuild);
        const enabledPatches = Object.entries(QOL_PATCHES)
            .filter(([key, patch]) => {
                const isCompatible = this.isCompatibleBuild(patch, selectedBuild);
                const isEnabled = preferences[key] ?? patch.defaultEnabled;
                return isCompatible && isEnabled;
            })
            .map(([_, patch]) => patch.id);

        this.setCookie(STORAGE_KEYS.ENABLED_PATCHES, enabledPatches, 365);
    }

    static saveSelectedBuild(buildDate) {
        this.setCookie(STORAGE_KEYS.RELEASE_DATE, buildDate, 365);
    }

    static clearStorage() {
        this.setCookie(STORAGE_KEYS.ENABLED_PATCHES, []);
    }
}