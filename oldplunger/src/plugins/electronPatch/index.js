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

  patches: [
    {
      find: "powerMonitor",
      replacement: [
        {
          match:
            /(?:this|[a-zA-Z]\.default)\.requireElectron\(\"powerMonitor\",!0\)/,
          replace: "window.DiscordNative.powerMonitor",
        },
      ],
    },
    {
      find: 'requireElectron("app"',
      replacement: [
        {
          match: /([a-zA-Z])\.default\.requireElectron\("app",!0\)/,
          replace: "window.OldcordNative.app",
        },
      ],
    },
    {
      find: '"devtools-opened"',
      replacement: [
        {
          match:
            /var \w=\w\.default\._getCurrentWindow\(\)\.webContents;\w\.removeAllListeners\("devtools-opened"\),\w\.on\("devtools-opened",function\(\){return\(0,\w\.consoleWarning\)\(\w\.default\.Messages\)}\)/,
          replace: "",
        },
      ],
    },
    {
      find: 'requireElectron("webFrame"',
      replacement: [
        {
          match:
            /var \w=this.requireElectron\("webFrame"\);\w.setZoomFactor&&\w.setZoomFactor\(\w\/100\)/,
          replace: "",
        },
      ],
    },
  ],

  async start() {
    window.module = {
      paths: [],
    };
    window.OldcordNative = {};

    let preloadedPaths = {};

    try {
      logger.info("Pre-loading required synchronous paths...");
      preloadedPaths.appData = await window.DiscordNative.app.getPath(
        "appData"
      );
      logger.info(`'appData' path pre-loaded: ${preloadedPaths.appData}`);
    } catch (err) {
      logger.error("Fatal: Could not pre-load app paths for shimming.", err);
      preloadedPaths.appData = "";
    }

    const appShim = {
      getPath: (name) => {
        if (preloadedPaths[name]) {
          return preloadedPaths[name];
        }
        logger.error(
          `Synchronous getPath requested for '${name}', but it was not pre-loaded!`
        );
        return null;
      },

      getVersion: () => window.DiscordNative.app.getVersion(),

      getPathAsync: (name) => window.DiscordNative.app.getPath(name),
    };

    const originalApp = window.DiscordNative.app;
    window.OldcordNative.app = { ...originalApp, ...appShim };

    window.__require = (module) => {
      logger.info(`Shimming module: ${module}`);
      switch (module) {
        case "process": {
          return window.DiscordNative.process;
        }
        case "electron": {
          const electronShim = {
            remote: {
              ...window.DiscordNative.remoteApp,
              getGlobal: (globalVar) => {
                switch (globalVar) {
                  case "releaseChannel": {
                    return window.DiscordNative.remoteApp.getReleaseChannel();
                  }
                  case "features": {
                    return window.DiscordNative.features;
                  }
                  case "mainAppDirname": {
                    try {
                      const version = window.DiscordNative.app.getVersion();
                      return window.DiscordNative.fileManager.join(
                        window.DiscordNative.process.env.LOCALAPPDATA,
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
                  return window.DiscordNative.remoteApp.getVersion();
                },
              },
              require: (module) => {
                return window.__require(module);
              },
              getCurrentWindow: () => {
                return window.DiscordNative.window;
              },
            },
            ipcRenderer: window.DiscordNative.ipc,
          };

          return electronShim;
        }
        case "os": {
          const osShim = {
            ...window.DiscordNative.os,
            release: () => {
              return window.DiscordNative.os.release;
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
                window.DiscordNative.fileManager.join
              );
            },
            globalPaths: [],
          };

          return moduleShim;
        }
        case "path": {
          const pathShim = {
            join: (...args) => {
              return window.DiscordNative.fileManager.join(...args);
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
            window.DiscordNative.nativeModules.requireModule("discord_utils");

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
          return window.DiscordNative.nativeModules.requireModule(module);
        }
      }
    };
  },
};
