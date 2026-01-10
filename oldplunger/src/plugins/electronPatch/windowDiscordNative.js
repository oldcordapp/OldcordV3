import { createDeepMock, logger } from './index.js';

export default async () => {
  const DiscordNative = window.DiscordNative;

  const PatchedNative = {};
  const ipcListeners = {};

  const nativeModulesShim = {
    requireModule: (moduleName) => {
      switch (moduleName) {
        case 'discord_spellcheck': {
          logger.info("Shimming 'discord_spellcheck' module for 2018+ compatibility.");

          try {
            const modernSpellcheck =
              DiscordNative.nativeModules.requireModule('discord_spellcheck');

            const getAvailableLocales = () => {
              if (!modernSpellcheck?.cld?.LANGUAGES) {
                logger.warn("Modern spellcheck module missing cld data. Falling back to 'en-US'.");
                return ['en-US'];
              }

              const commonLocaleMap = {
                en: 'en-US',
                de: 'de-DE',
                fr: 'fr-FR',
                es: 'es-ES',
                it: 'it-IT',
                pt: 'pt-BR',
                ru: 'ru-RU',
                pl: 'pl-PL',
                ja: 'ja-JP',
                ko: 'ko-KR',
                zh: 'zh-CN',
              };

              const languageMap = modernSpellcheck.cld.LANGUAGES;
              const locales = Object.values(languageMap)
                .filter((langCode) => typeof langCode === 'string' && langCode.length === 2)
                .map((langCode) => {
                  return commonLocaleMap[langCode] || `${langCode}-${langCode.toUpperCase()}`;
                })
                .filter((value, index, self) => self.indexOf(value) === index);

              if (!locales.includes('en-US')) {
                locales.unshift('en-US');
              }
              return locales;
            };

            const DummySpellchecker = class Spellchecker {
              setDictionary(locale) {
                logger.log(`[Spellcheck Shim] setDictionary called with: ${locale}.`);
                return true;
              }
              isMisspelled(_word) {
                return false;
              }
              getCorrectionsForMisspelling(_word) {
                return [];
              }
              getAvailableDictionaries() {
                return getAvailableLocales();
              }
            };

            return {
              Spellchecker: DummySpellchecker,
              keyboardLayout: {
                getInstalledKeyboardLanguages: () => getAvailableLocales(),
              },
            };
          } catch (err) {
            logger.error(
              "Failed to create 'discord_spellcheck' shim. Providing a deep mock to prevent crash.",
              err,
            );
            return createDeepMock('discord_spellcheck', logger);
          }
        }
        case 'discord_utils': {
          logger.info("Shimming 'discord_utils' module for 2018+ compatibility.");
          try {
            const modernDiscordUtils = DiscordNative.nativeModules.requireModule('discord_utils');

            return {
              ...modernDiscordUtils,
              getIdleMilliseconds: (callback) => {
                if (typeof callback === 'function') {
                  callback(0);
                }
              },
            };
          } catch (err) {
            logger.error(
              "Failed to create 'discord_utils' shim. Providing a deep mock to prevent crash.",
              err,
            );
            return createDeepMock('discord_utils', logger);
          }
        }
        default: {
          try {
            const module = DiscordNative.nativeModules.requireModule(moduleName);

            if (module) {
              return module;
            }
          } catch (err) {
            logger.warn(
              `Native module '${moduleName}' not found. Providing a deep mock to prevent crash.`,
              err,
            );
            return createDeepMock(moduleName, logger);
          }
        }
      }
    },
    ensureModule: (originalModuleName) => {
      logger.info(`Shimming ensureModule for '${originalModuleName}' with modern implementation.`);

      const legacyModulesToFake = ['discord_contact_import'];

      const simulateSuccess = () => {
        if (ipcListeners['MODULE_INSTALLED']) {
          ipcListeners['MODULE_INSTALLED'].forEach((listener) => {
            listener({}, originalModuleName, true);
          });
        }
      };

      if (legacyModulesToFake.includes(originalModuleName)) {
        logger.warn(
          `Faking successful installation of legacy module '${originalModuleName}' to prevent a crash.`,
        );
        setTimeout(simulateSuccess, 0);
        return Promise.resolve();
      }

      let moduleToInstall = originalModuleName;
      if (moduleToInstall === 'discord_overlay') {
        logger.info(
          `Remapping 'discord_overlay' to 'discord_overlay2' for modern client compatibility.`,
        );
        moduleToInstall = 'discord_overlay2';
      }

      const promise = DiscordNative.nativeModules.ensureModule(moduleToInstall);

      promise
        .then(() => {
          logger.info(
            `Successfully ensured '${moduleToInstall}'. Simulating 'MODULE_INSTALLED' for '${originalModuleName}'.`,
          );
          simulateSuccess();
        })
        .catch((err) => {
          logger.error(
            `Ensuring '${moduleToInstall}' failed. Faking success for '${originalModuleName}' to prevent client crash.`,
            err,
          );
          simulateSuccess();
        });

      return promise.catch(() => {});
    },
  };

  const nativeModulesProxy = new Proxy(nativeModulesShim, {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop, receiver);
      }
      const originalProp = Reflect.get(DiscordNative.nativeModules, prop);
      if (typeof originalProp === 'function') {
        return originalProp.bind(DiscordNative.nativeModules);
      }
      return originalProp;
    },
  });

  PatchedNative.nativeModules = nativeModulesProxy;

  PatchedNative.globals = {
    features: DiscordNative.features,
  };

  let preloadedPaths = {};
  try {
    preloadedPaths.appData = await DiscordNative.app.getPath('appData');
  } catch (err) {
    logger.error('Fatal: Could not pre-load appData for shimming.', err);
    preloadedPaths.appData = '';
  }

  const appShim = Object.create(DiscordNative.app);
  appShim.getPathSync = (name) => {
    if (preloadedPaths[name]) {
      return preloadedPaths[name];
    }
    logger.error(`Synchronous getPath requested for '${name}', but it was not pre-loaded!`);
    return null;
  };
  PatchedNative.app = appShim;

  const fakeIpc = {
    send: (channel, ...args) => {
      if (channel === 'MODULE_INSTALL') {
        const moduleName = args[0];
        logger.info(
          `Intercepted IPC 'MODULE_INSTALL' for '${moduleName}'. Routing to shimed ensureModule.`,
        );
        window._OldcordNative.nativeModules.ensureModule(moduleName);
        return;
      }

      logger.info(
        `IPC Send: ${channel}`,
        ...args.map((arg) => {
          if (typeof arg === 'object' && arg !== null) {
            return JSON.stringify(arg);
          }
          return arg;
        }),
      );
      try {
        return Reflect.apply(DiscordNative.ipc.send, DiscordNative.ipc, [channel, ...args]);
      } catch (err) {
        logger.error(`ipcRenderer.send failed:`, err);
        return undefined;
      }
    },
    on: (channel, listener) => {
      if (channel === 'MODULE_INSTALLED') {
        logger.info(`Intercepted IPC listener registration for '${channel}'.`);
        if (!ipcListeners[channel]) {
          ipcListeners[channel] = [];
        }
        ipcListeners[channel].push(listener);
      }
      return DiscordNative.ipc.on(channel, listener);
    },
    removeListener: (channel, listener) => {
      if (channel === 'MODULE_INSTALLED' && ipcListeners[channel]) {
        const index = ipcListeners[channel].indexOf(listener);
        if (index > -1) {
          ipcListeners[channel].splice(index, 1);
        }
      }
      return DiscordNative.ipc.removeListener(channel, listener);
    },
  };

  const ipcRendererShim = new Proxy(fakeIpc, {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop, receiver);
      }
      const originalProp = Reflect.get(DiscordNative.ipc, prop);
      if (typeof originalProp === 'function') {
        return originalProp.bind(DiscordNative.ipc);
      }
      return originalProp;
    },
    has(target, prop) {
      return Reflect.has(target, prop) || Reflect.has(DiscordNative.ipc, prop);
    },
  });

  PatchedNative.ipc = ipcRendererShim;

  const handler = {
    get(target, prop, receiver) {
      if (Reflect.has(target, prop)) {
        return Reflect.get(target, prop, receiver);
      }
      return Reflect.get(DiscordNative, prop, receiver);
    },
    has(target, prop) {
      return Reflect.has(target, prop) || Reflect.has(DiscordNative, prop);
    },
  };

  window._OldcordNative = new Proxy(PatchedNative, handler);
  logger.info('Successfully created a Proxy to wrap window.DiscordNative.');
};
