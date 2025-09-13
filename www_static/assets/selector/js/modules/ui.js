import { builds, defaultBuild } from '../config/builds.js';
import { CHANGELOGS, videos } from '../config/changelogs.js';
import { QOL_PATCHES } from '../config/patches.js';
import { Dialog } from './dialog.js';
import { Settings } from './settings.js';

export class UI {
    static renderContent(container, content) {
        container.innerHTML = content;
    }

    static createQolOption(patch, selectedBuild) {
        const isElectron = window.DiscordNative !== undefined;
        const isElectronPatch = patch.id === 'electronPatch';
        const forceDisabled = isElectronPatch && !isElectron;
        const preferences = Settings.getBuildPreferences(selectedBuild);

        let isChecked = preferences[patch.id] ?? patch.defaultEnabled;
        let isDisabledByIncompatibility = false;

        if (isChecked) {
            for (const incompatiblePatchId of patch.incompatiblePatches) {
                const isOffendingPatchEnabled = preferences[incompatiblePatchId] ?? QOL_PATCHES[incompatiblePatchId]?.defaultEnabled;
                if (isOffendingPatchEnabled) {
                    isChecked = false;
                    isDisabledByIncompatibility = true;
                    break;
                }
            }
        }

        const element = document.createElement('div');
        element.className = 'qol-option';

        element.innerHTML = `
             <label class="toggle mb-sm">
                <input type="checkbox" id="${patch.id}" 
                        ${forceDisabled || patch.mandatory || isDisabledByIncompatibility ? 'disabled' : ''}
                        ${isChecked ? 'checked' : ''}>
                <span class="toggle-slider"></span>
                <span class="toggle-label text-normal">${patch.label}</span>
                <div class="info-tooltip">
                     <i class="info-icon">i</i>
                    <span class="tooltip-text">${patch.description}</span>
                </div>
        </label> `;

        const tooltipWrapper = document.createElement('div');
        tooltipWrapper.className = 'tooltip-wrapper';
        const tooltip = document.createElement('span');
        tooltip.className = 'tooltip-text';
        tooltip.textContent = patch.description;
        tooltipWrapper.appendChild(tooltip);
        document.body.appendChild(tooltipWrapper);

        const infoTooltip = element.querySelector('.info-tooltip');
        infoTooltip.addEventListener('mouseenter', () => {
            const rect = infoTooltip.getBoundingClientRect();
            tooltip.style.left = `${rect.right + 8}px`;
            tooltip.style.top = `${rect.top + (rect.height / 2)}px`;
            tooltip.style.transform = 'translateY(-50%)';
            tooltip.style.visibility = 'visible';
        });

        infoTooltip.addEventListener('mouseleave', () => {
            tooltip.style.visibility = 'hidden';
        });

        const checkbox = element.querySelector(`#${patch.id}`);
        if (checkbox && !patch.mandatory && !isDisabledByIncompatibility) {
            checkbox.addEventListener('change', () => this.handlePatchChange(patch.id, checkbox.checked, selectedBuild));
        } else if (isDisabledByIncompatibility) {
            // Add a tooltip or message for incompatibility
            const tooltipText = element.querySelector('.tooltip-text');
            tooltipText.textContent = `This patch is disabled because it is incompatible with another enabled patch.`;
        }

        return element;
    }


    static handlePatchChange(patchId, checked, selectedBuild) {
        const prefs = Settings.getBuildPreferences(selectedBuild);
        prefs[patchId] = checked;
        Settings.saveBuildPreferences(selectedBuild, prefs);
        Settings.updateEnabledPatches(selectedBuild);
    }

    static updateQolOptions(selectedBuild) {
        const container = document.getElementById('qolOptions');
        container.innerHTML = '';

        Object.entries(QOL_PATCHES)
            .filter(([_, patch]) => Settings.isCompatibleBuild(patch, selectedBuild))
            .forEach(([_, patch]) => {
                container.appendChild(this.createQolOption(patch, selectedBuild));
            });

        Settings.updateEnabledPatches(selectedBuild);
    }

    static initializeBuildSelect() {
        const select = document.getElementById('buildSelect');
        const buildSelect = document.querySelector('.build-select');
        const button = buildSelect.querySelector('.build-select-button');
        const menu = buildSelect.querySelector('.build-select-menu');
        
        // Populate hidden select and custom menu
        builds.forEach(build => {
            const option = document.createElement('option');
            option.value = build;
            option.textContent = this.formatBuildDate(build);
            select.appendChild(option);
            
            const menuOption = document.createElement('div');
            menuOption.className = 'build-select-option';
            menuOption.textContent = this.formatBuildDate(build);
            menuOption.dataset.value = build;
            menu.appendChild(menuOption);
        });

        select.value = defaultBuild;
        button.textContent = this.formatBuildDate(defaultBuild);
        menu.querySelector(`[data-value="${defaultBuild}"]`).classList.add('selected');

        this.updateContent();

        button.addEventListener('click', () => {
            buildSelect.classList.toggle('active');
        });

        menu.addEventListener('click', (e) => {
            const option = e.target.closest('.build-select-option');
            if (!option) return;

            const value = option.dataset.value;
            select.value = value;
            button.textContent = option.textContent;
            
            menu.querySelector('.selected')?.classList.remove('selected');
            option.classList.add('selected');
            
            buildSelect.classList.remove('active');
            this.updateContent();
        });

        document.addEventListener('click', (e) => {
            if (!buildSelect.contains(e.target)) {
                buildSelect.classList.remove('active');
            }
        });
    }

    static formatBuildDate(build) {
        return build.replace(/_/g, ' ')
            .replace(/(\d+)(st|nd|rd|th)?/g, '$1')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    static updateContent() {
        const selectedBuild = document.getElementById('buildSelect').value;
        this.updateChangelog(selectedBuild);
        this.updateQolOptions(selectedBuild);
    }

    static updateChangelog(build) {
        let content = '';
        if (videos[build]) {
            content += this.renderVideo(build);
        }
        content += this.renderChangelog(build);
        this.renderContent(document.getElementById('changelogContent'), content);
    }

    static renderChangelog(build) {
        const changelog = CHANGELOGS[build];
        if (!changelog) return '<p class="text-muted">No changelog available for this build.</p>';

        // Split into lines and remove empty ones
        const lines = changelog.split('\n').filter(line => line.trim());
        let html = '';
        
        // Process the changelog content
        let currentSection = { title: '', items: [] };
        let sections = [];
        let inFrontmatter = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip frontmatter and formatting tags
            if (line === '---changelog---' || line === '---' || line.match(/^\{.*\}$/)) {
                inFrontmatter = line.includes('changelog');
                continue;
            }
            if (inFrontmatter) continue;

            // Skip CTA blocks
            if (line.startsWith('[cta:')) continue;

            // Clean up section headers
            const cleanLine = line.replace(/\{.*?\}/g, '').trim();
            
            // Check for section headers
            const isHeader = cleanLine.match(/^([^=\n]+?)$/);
            const isSeparator = line.match(/^=+$/);
            
            if ((isHeader && i + 1 < lines.length && lines[i + 1].match(/^=+$/)) || 
                line.match(/\{changelog-[^}]+\}$/)) {
                
                // Save previous section if it has items
                if (currentSection.items.length > 0) {
                    sections.push({ ...currentSection });
                }

                // Start new section
                currentSection = {
                    title: cleanLine,
                    items: []
                };
                
                // Skip the separator line
                if (isSeparator) i++;
                
                continue;
            }

            // Handle list items and text
            if (cleanLine && !isSeparator) {
                if (cleanLine.startsWith('*')) {
                    currentSection.items.push(cleanLine);
                } else {
                    // If it's not a list item and we don't have a current section,
                    // create a blank-titled section
                    if (currentSection.items.length === 0 && currentSection.title === '') {
                        currentSection.title = '';
                    }
                    currentSection.items.push(`* ${cleanLine}`);
                }
            }
        }

        // Add the last section if it has items
        if (currentSection.items.length > 0) {
            sections.push(currentSection);
        }

        // Render all sections
        for (const section of sections) {
            const formattedItems = section.items.map(item => this.formatChangelogItem(item));
            html += this.renderSection(section.title, formattedItems);
        }

        return html || '<p class="text-muted">No changelog content available.</p>';
    }

    static formatChangelogItem(item) {
        return item
            .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>') // Bold - improved regex to properly match pairs
            .replace(/^\s*\*\s*/, '') // Remove asterisk
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>') // Links
            .replace(/~~~(.+?)~~~/g, '<del>$1</del>') // Strikethrough
            .replace(/_([^_]+)_/g, '<em>$1</em>') // Italics
            .replace(/\{.*?\}/g, ''); // Remove any remaining formatting tags
    }

    static renderSection(title, items) {
        if (!items.length) return '';
        return `
            <h4>${title.toUpperCase()}</h4>
            <ul class="changelog-list">
                ${items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        `;
    }

    static renderVideo(build) {
        const videoId = videos[build];
        if (!videoId) return '';
        
        return `
            <div class="video-container">
                <iframe 
                    src="https://www.youtube.com/embed/${videoId}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
            </div>`;
    }

    static toggleAdvancedSettings(show) {
        const selectorGrid = document.querySelector('.selector-grid');
        const advancedGrid = document.querySelector('.advanced-settings-grid');
        
        if (show) {
            document.getElementById('clearFailedUrlsButton').addEventListener('click', this.handleClearFailedUrls);
            this.initializeDebugMode();
            selectorGrid.classList.add('card-exit');
            advancedGrid.style.display = 'grid';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    advancedGrid.classList.add('show');
                    setTimeout(() => {
                        selectorGrid.style.display = 'none';
                    }, 300);
                });
            });
        } else {
            document.getElementById('clearFailedUrlsButton').removeEventListener('click', this.handleClearFailedUrls);
            selectorGrid.style.display = 'grid';
            advancedGrid.classList.add('card-exit');
            selectorGrid.classList.remove('card-exit');
            setTimeout(() => {
                advancedGrid.classList.remove('show');
                advancedGrid.classList.remove('card-exit');
                advancedGrid.style.display = 'none';
            }, 300);
        }
    }

    static initializeDebugMode() {
        const debugSwitch = document.getElementById('debugModeSwitch');
        debugSwitch.checked = document.cookie.includes('debug_mode=true');
        
        debugSwitch.addEventListener('change', () => {
            if (debugSwitch.checked) {
                document.cookie = 'debug_mode=true;path=/';
            } else {
                document.cookie = 'debug_mode=false;path=/;expires=Thu, 01 Jan 1970 00:00:01 GMT';
            }
        });
    }

    static handleClearFailedUrls() {
        Dialog.show({
            title: 'Reset Failed Chunk Cache?',
            content: `
                <p>This will clear the list of all previously failed chunk downloads, allowing the bootloader to retry downloading missing chunks from the CDN.</p>
                <p class="mt-md">Only use this if:</p>
                <ul>
                    <li>New chunks have been uploaded to the CDN</li>
                    <li>You want to retry downloading previously unavailable chunks</li>
                </ul>
                <p class="dialog-notice mt-md">⚠️ Warning: This will reset the failed chunk cache for ALL builds. The bootloader will attempt to redownload chunks that were previously marked as missing, which may slow down loading times if the chunks are still unavailable.</p>
            `,
            buttons: [
                { id: 'textButton', label: 'Cancel', onClick: () => Dialog.hide() },
                { 
                    id: 'negativeButton', 
                    label: 'Delete', 
                    onClick: () => {
                        localStorage.removeItem('oldcord_failed_urls');
                        Dialog.hide();
                    }
                }
            ]
        });
    }
}

export class Launcher {
    static currentPlatform = window.DiscordNative ? 'electron' : 'web';
    static instanceConfig = null;

    static async initialize() {
        try {
            const configResponse = await fetch('/instance');
            
            if (configResponse.ok) {
                const config = await configResponse.json();
                this.instanceConfig = config;
                this.setupLegalLinks();
            }
        } catch (e) {
            console.warn('Instance config not available');
        }
    }

    static setupLegalLinks() {
        if (!this.instanceConfig) return;

        const instanceContent = document.getElementById('instanceContent');
        instanceContent.style.display = 'block';

        const welcomeDiv = document.getElementById('instanceWelcome');
        welcomeDiv.textContent = `Welcome to ${this.instanceConfig.instance.name}!`;

        const descriptionDiv = document.getElementById('instanceDescription');
        if (this.instanceConfig.instance.description) {
            descriptionDiv.textContent = this.instanceConfig.instance.description;

            const legalConfig = this.instanceConfig.instance.legal;
            if (legalConfig && Object.keys(legalConfig).some(key => legalConfig[key])) {
                descriptionDiv.classList.add('has-legal');
            }
        }

        const legalConfig = this.instanceConfig.instance.legal;
        const legalLinks = document.getElementById('legalLinks');
            
            if (legalConfig.terms) {
                const termsLink = document.getElementById('termsLink');
                termsLink.style.display = 'block';
                termsLink.href = legalConfig.terms};
            if (legalConfig.privacy) {
                const privacyLink = document.getElementById('privacyLink');
                privacyLink.style.display = 'block';
                privacyLink.href = legalConfig.privacy
            };
            if (legalConfig.instanceRules) {
                const rulesLink = document.getElementById('rulesLink');
                rulesLink.style.display = 'block';
                rulesLink.href = legalConfig.instanceRules
            };

            if (legalConfig.extras) {
                Object.entries(legalConfig.extras).forEach(([key, url]) => {
                    const link = document.createElement('a');
                    link.href = url;
                    link.textContent = key.replace(/_/g, ' ')
                                        .split(' ')
                                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                        .join(' ');
                    link.className = 'legal-link';
                    legalLinks.appendChild(link);
                });
            }
    }

    static isElectronRestricted(build) {
        const restrictedBuilds = ["april_1_2018"];
        return this.currentPlatform === 'electron' && restrictedBuilds.includes(build);
    }

    static async handleTransition() {
        return new Promise(resolve => {
            const background = document.querySelector('.background');
            const selectorGrid = document.querySelector('.selector-grid');
            const logo = document.querySelector('.logo-container');
            const dialogBox = document.getElementById('dialogBox');

            dialogBox.style.display = 'none';
            background.classList.add('fade');
            selectorGrid.classList.add('fade');
            logo.classList.add('fade');

            setTimeout(() => {
                background.classList.remove('loaded');
                resolve();
            }, 500);
        });
    }

    static async showDialogs(selectedBuild, enabledMods) {
        if (!await this.showConfirmationDialog(selectedBuild, enabledMods)) return;
        if (!await this.showEnvironmentWarningIfNeeded()) return;
        if (!await this.showLegalAgreementIfNeeded()) return;
        if (this.isElectronRestricted(selectedBuild)) {
            this.showElectronRestrictedDialog();
            return;
        }

        Settings.saveSelectedBuild(selectedBuild);
        Settings.updateEnabledPatches(selectedBuild);
        
        await this.handleTransition();
        
        window.location.href = `launch?release_date=${selectedBuild}`;
    }

    static async showConfirmationDialog(selectedBuild, enabledMods) {
        const electronNotice = this.currentPlatform === 'electron' ? 
            '<p class="dialog-notice mt-md mb-md">You\'re using the desktop client. Some builds might not work due to patches not being completed yet.</p>' : '';

        const formattedBuild = selectedBuild
            .replace(/_/g, ' ')
            .replace(/(\b[a-z])/g, (letter) => letter.toUpperCase());

        return new Promise(resolve => {
            Dialog.show({
                title: 'Build Confirmation',
                content: `
                    <p>Selected Build: ${formattedBuild}</p>
                    ${enabledMods.length ? '<p>Enabled Mods:</p><ul>' + 
                        enabledMods.map(mod => `<li>${mod}</li>`).join('') + 
                        '</ul>' : ''}
                    ${electronNotice}
                `,
                buttons: [
                    { id: 'textButton', label: 'Cancel', onClick: () => resolve(false) },
                    { id: 'positiveButton', label: 'Launch', onClick: () => resolve(true) }
                ]
            });
        });
    }

    static async showEnvironmentWarningIfNeeded() {
        const currentEnv = this.instanceConfig?.instance?.environment?.toLowerCase();
        if (currentEnv === 'production' || currentEnv === 'stable') return true;
        if (!currentEnv) return true;

        const envName = currentEnv.charAt(0).toUpperCase() + currentEnv.slice(1).toLowerCase();
        return new Promise(resolve => {
            Dialog.show({
                title: `${envName} Warning`,
                content: `This is a/an ${currentEnv} instance and may be unstable. Do you want to continue?`,
                buttons: [
                    { id: 'textButton', label: 'Cancel', onClick: () => resolve(false) },
                    { id: 'positiveButton', label: 'Continue', onClick: () => resolve(true) }
                ]
            });
        });
    }

    static async showLegalAgreementIfNeeded() {
        if (document.cookie.includes('legal_agreed=true')) return true;

        const legal = this.instanceConfig?.instance?.legal;
        if (!legal || !Object.keys(legal || {}).some(key => legal[key])) return true;

        const legalLinks = [
            ...(legal.terms ? [{ title: 'Terms of Service', url: legal.terms }] : []),
            ...(legal.privacy ? [{ title: 'Privacy Policy', url: legal.privacy }] : []),
            ...(legal.instanceRules ? [{ title: 'Instance Rules', url: legal.instanceRules }] : []),
            ...(legal.extras ? 
                Object.entries(legal.extras).map(([key, url]) => ({
                    title: this.formatLinkTitle(key),
                    url
                })) : []
            )
        ];

        const result = await new Promise(resolve => {
            Dialog.show({
                title: 'Legal Agreement',
                content: `
                    <p>By continuing, you agree to our:</p>
                    <ul style="list-style: none; padding: 0; margin: 16px 0;">
                        ${legalLinks.map(link => `
                            <li style="margin: 8px 0;">
                                <a href="${link.url}" target="_blank" 
                                   class="legal-link">
                                    ${link.title}
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                `,
                buttons: [
                    { id: 'textButton', label: 'Cancel', onClick: () => resolve(false) },
                    { id: 'positiveButton', label: 'I Agree', onClick: () => resolve(true) }
                ]
            });
        });

        if (result) {
            document.cookie = `legal_agreed=true;path=/`;
        }

        return result;
    }

    static formatLinkTitle(key) {
        return key.replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    static showElectronRestrictedDialog() {
        Dialog.show({
            title: 'Build Not Usable',
            content: 'This build is not usable on the Desktop Client either due to missing JavaScript files or other reasons.',
            buttons: [{ id: 'generalButton', label: 'Ok' }]
        });
    }
}