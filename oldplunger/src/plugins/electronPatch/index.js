import { Logger } from "../../utils/logger.js";

const logger = new Logger("Electron Patches");

function getNodeModulePaths(startPath, joiner) {
  if (!startPath || !joiner) return [];

  const parts = startPath.split(/\\|\//);
  const paths = [];

  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] === "node_modules") continue;
    const subParts = parts.slice(0, i + 1);
    const p = joiner.apply(null, subParts);
    paths.push(joiner(p, "node_modules"));
  }
  return paths;
}

function createDeepMock(moduleName, logger) {
  const handler = {
    get(target, prop, receiver) {
      return (...args) => {
        logger.log(
          `[Mock: ${moduleName}] Method '${String(
            prop
          )}' was called. Doing nothing.`
        );
        return receiver;
      };
    },
  };
  return new Proxy({}, handler);
}

export default {
  target: "electron",
  name: "Electron Patches",
  description:
    "Required for client functionality. Automatically enabled on desktop client.",
  authors: ["Oldcord Team"],
  mandatory: false,
  configurable: false,
  defaultEnabled: false,
  compatibleBuilds: "all",
  incompatiblePlugins: [],
  debug: true,
  bypassEvalTypeError: true,

  patches: [
    {
      find: "powerMonitor",
      replacement: [
        {
          match: /(?:this|\w+\.default)\.requireElectron\("powerMonitor",!0\)/,
          replace: "window._OldcordNative.powerMonitor",
        },
      ],
    },
    {
      find: 'requireElectron("app"',
      replacement: [
        {
          match: /\w+\.default\.requireElectron\("app",!0\)/,
          replace: "window._OldcordNative.app",
        },
      ],
    },
    {
      find: '"devtools-opened"',
      replacement: [
        {
          match:
            /var \w+=\w+\.default\._getCurrentWindow\(\)\.webContents;\w+\.removeAllListeners\("devtools-opened"\),\w+\.on\("devtools-opened",function\(\){return\(0,\w+\.consoleWarning\)\(\w+\.default\.Messages\)}\)/,
          replace: "",
        },
      ],
    },
    {
      find: 'requireElectron("webFrame"',
      replacement: [
        {
          match:
            /var (\w+)=this\.requireElectron\("webFrame"\);\1\.setZoomFactor&&\1\.setZoomFactor\(\w+\/100\)/,
          replace: "",
        },
      ],
    },
    {
      find: /this\.send\("UPDATE_CRASH_REPORT",\w+\)/,
      replacement: [
        {
          match:
            /updateCrashReporter:function\([^)]*\)\{[\s\S]*?\},flushDNSCache/,
          replace: "updateCrashReporter:function(){},flushDNSCache",
        },
      ],
    },
    {
      find: /\w+\.send\("BADGE_IS_ENABLED"\)/,
      replacement: [
        {
          match: /setBadge:function\([^)]*\)\{[\s\S]*?\},setSystemTrayIcon/,
          replace: "setBadge:function(){},setSystemTrayIcon",
        },
      ],
    },
    {
      find: /"discord:\/\/"/,
      replacement: [
        {
          match: /"discord:\/\/"/,
          replace: `"oldcord://"`,
        },
      ],
    },
    {
      find: "window.DiscordNative",
      replacement: [
        {
          match: "window.DiscordNative",
          replace: "window._OldcordNative",
        },
      ],
    },
    {
      find: /\.default\.require\("path"\)/,
      replacement: [
        {
          match: /(\w+)\.getPath\("appData"\)/,
          replace: "$1.getPathSync(\"appData\")"
        }
      ]
    }
  ],

  async start() {
    window.module = {
      paths: [],
    };

    const DiscordNative = window.DiscordNative;

    const PatchedNative = {};

    PatchedNative.globals = {
      features: DiscordNative.features,
    };

    let preloadedPaths = {};
    try {
      preloadedPaths.appData = await DiscordNative.app.getPath("appData");
    } catch (err) {
      logger.error("Fatal: Could not pre-load appData for shimming.", err);
      preloadedPaths.appData = "";
    }

    const appShim = Object.create(DiscordNative.app);
    appShim.getPathSync = (name) => {
      if (preloadedPaths[name]) {
        return preloadedPaths[name];
      }
      logger.error(
        `Synchronous getPath requested for '${name}', but it was not pre-loaded!`
      );
      return null;
    };
    PatchedNative.app = appShim;

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
    logger.info("Successfully created a Proxy to wrap window.DiscordNative.");

    window.__require = (module) => {
      logger.info(`Shimming module: ${module}`);
      switch (module) {
        case "process": {
          return window._OldcordNative.process;
        }
        case "electron": {
          const createWindowShim = () => {
            const originalWindow = window._OldcordNative.window;
            return {
              ...originalWindow,
              isFocused: () => document.hasFocus(),
              isMaximized: () => {
                return false;
              },
              isFullScreen: () => document.fullscreenElement != null,
              unmaximize: originalWindow.restore,
            };
          };

          const electronShim = {
            remote: {
              ...window._OldcordNative.remoteApp,
              getGlobal: (globalVar) => {
                switch (globalVar) {
                  case "releaseChannel": {
                    return window._OldcordNative.remoteApp.getReleaseChannel();
                  }
                  case "features": {
                    return window._OldcordNative.features;
                  }
                  case "mainAppDirname": {
                    try {
                      const version = window._OldcordNative.app.getVersion();
                      return window._OldcordNative.fileManager.join(
                        window._OldcordNative.process.env.LOCALAPPDATA,
                        "Oldcord",
                        `app-${version}`,
                        "resources",
                        "app.asar"
                      );
                    } catch (err) {
                      logger.error("Failed to construct mainAppDirname:", err);
                      return undefined;
                    }
                  }
                  default: {
                    logger.warn(
                      `remote.getGlobal could not find a handler for global variable "${globalVar}"`
                    );
                    return undefined;
                  }
                }
              },
              app: {
                getVersion: () => {
                  return window._OldcordNative.remoteApp.getVersion();
                },
              },
              require: (module) => {
                return window.__require(module);
              },
              getCurrentWindow: createWindowShim,
            },
            ipcRenderer: window._OldcordNative.ipc,
          };

          return electronShim;
        }
        case "os": {
          const osShim = {
            ...window._OldcordNative.os,
            release: () => {
              return window._OldcordNative.os.release;
            },
          };

          return osShim;
        }
        case "module": {
          const moduleShim = {
            _nodeModulePaths: (startPath) => {
              if (!startPath) {
                logger.warn(
                  "'_nodeModulePaths' called without a start path. Returning empty array."
                );
                return [];
              }

              return getNodeModulePaths(
                startPath,
                window._OldcordNative.fileManager.join
              );
            },
            globalPaths: [],
          };

          return moduleShim;
        }
        case "path": {
          const pathShim = {
            join: (...args) => {
              return window._OldcordNative.fileManager.join(...args);
            },
          };
          return pathShim;
        }
        case "./VoiceEngine":
        case "discord_voice": {
          logger.info(
            "Providing a deep mock for the native 'discord_voice' module."
          );

          const mockVoiceEngineInstance = createDeepMock(
            "discord_voice engine",
            logger
          );

          const discordVoiceShim = {
            default: {
              getVoiceEngine: (...args) => {
                logger.log(
                  "[Voice Mock] 'getVoiceEngine' was called with args:",
                  args
                );
                return mockVoiceEngineInstance;
              },
            },
          };

          return discordVoiceShim;
        }
        case "./Utils":
        case "discord_utils": {
          logger.info(
            "Providing a wrapped shim for the native 'discord_utils' module."
          );

          const originalUtils =
            window._OldcordNative.nativeModules.requireModule("discord_utils");

          const discordUtilsShim = {
            ...originalUtils,
            getIdleMilliseconds:
              originalUtils.getIdleMilliseconds ||
              ((callback) => {
                logger.warn(
                  "Shimmed discord_utils.getIdleMilliseconds: Function not found in modern module. Simulating 0ms idle time."
                );
                if (typeof callback === "function") {
                  callback(0);
                }
              }),
          };

          return discordUtilsShim;
        }
        case "querystring": {
          logger.info("Providing a deep mock for the 'querystring' module.");
          return createDeepMock("querystring", logger);
        }
        default: {
          return window._OldcordNative.nativeModules.requireModule(module);
        }
      }
    };
  },
};
