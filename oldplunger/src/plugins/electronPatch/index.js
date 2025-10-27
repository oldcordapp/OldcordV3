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
      find: '"devtools-opened"',
      replacement: [
        {
          match:
            /if\s*\((?:.|\s)*?\)\s*\{(?:.|\s)*?webContents(?:.|\s)*?removeAllListeners\("devtools-opened"\)(?:.|\s)*?\}\s*else\s*((?:.|\s)*?\.on\("changed",(?:.|\s)*?\))/,
          replace: "$1",
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
      find: "electron.asar",
      replacement: [
        {
          match: "electron.asar",
          replace: "app.asar",
        },
      ],
    },
  ],

  async start() {
    window.module = {
      paths: [],
    };

    const DiscordNative = window.DiscordNative;

    let appName = "Oldcord";
    try {
      const moduleDataPath = await DiscordNative.fileManager.getModulePath();
      const pathParts = moduleDataPath.replace(/\\/g, "/").split("/");
      const lowercaseAppName = pathParts[pathParts.length - 2];

      const nameMap = {
        oldcord: "Oldcord",
        discord: "Discord",
        discordcanary: "DiscordCanary",
        discordptb: "DiscordPTB",
        discorddevelopment: "DiscordDevelopment",
      };

      if (nameMap[lowercaseAppName]) {
        appName = nameMap[lowercaseAppName];
        logger.info(`Detected app name: ${appName}`);
      } else {
        logger.warn(
          `Could not map detected app name '${lowercaseAppName}'. Falling back to '${appName}'.`
        );
      }
    } catch (err) {
      logger.error(
        `Failed to determine app name, falling back to '${appName}'.`,
        err
      );
    }

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

    // Since IPC events are different, we need to gracefully error it out so that Discord still loads

    const fakeIpc = {
      send: (...args) => {
        logger.info(
          `IPC Args: ${args.map((arg) => {
            if (typeof arg === "object") {
              return JSON.stringify(arg);
            } else {
              return arg;
            }
          })}`
        );
        try {
          return Reflect.apply(DiscordNative.ipc.send, DiscordNative.ipc, args);
        } catch (err) {
          logger.error(`ipcRenderer.send failed:`, err);
          return undefined;
        }
      },
    };

    const ipcRendererShim = new Proxy(fakeIpc, {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }

        const originalProp = Reflect.get(DiscordNative.ipc, prop);

        if (typeof originalProp === "function") {
          return originalProp.bind(DiscordNative.ipc);
        }

        return originalProp;
      },
      has(target, prop) {
        return (
          Reflect.has(target, prop) || Reflect.has(DiscordNative.ipc, prop)
        );
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

          const remoteShim = new Proxy(
            {
              app: {
                getVersion: () => window._OldcordNative.remoteApp.getVersion(),
                dock: createDeepMock("electron.remote.app.dock", logger),
                getPath: (...args) => {
                  return window._OldcordNative.app.getPathSync(...args);
                },
              },
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
                        appName,
                        `app-${version}`,
                        "resources",
                        "app.asar"
                      );
                    } catch (err) {
                      logger.error("Failed to construct mainAppDirname:", err);
                      return undefined;
                    }
                  }
                  case "crashReporterMetadata": {
                    return window._OldcordNative.crashReporter.getMetadata();
                  }
                  default: {
                    logger.warn(
                      `remote.getGlobal could not find a handler for global variable "${globalVar}"`
                    );
                    return undefined;
                  }
                }
              },
              getCurrentWindow: createWindowShim,
              require: (module) => window.__require(module),
              powerMonitor: window._OldcordNative.powerMonitor,
              BrowserWindow: {
                fromId: (id) => createWindowShim(),
              },
            },
            {
              get(target, prop, receiver) {
                if (Reflect.has(target, prop)) {
                  return Reflect.get(target, prop, receiver);
                }

                return window.__require(prop);
              },
            }
          );

          const baseShim = {
            remote: remoteShim,
            ipcRenderer: window._OldcordNative.ipc,
          };

          const electronShim = new Proxy(baseShim, {
            get(target, prop) {
              if (prop in target) {
                return target[prop];
              }

              return window.__require("electron").remote[prop];
            },
          });

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
            `Due to old Discord not being happy with modern discord_voice, it is simply mocked for now.`
          );
          return createDeepMock("discord_voice", logger);
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
        case "erlpack": {
          return window._OldcordNative.nativeModules.requireModule(
            "discord_erlpack"
          );
        }
        default: {
          try {
            const remoteModule =
              window._OldcordNative.nativeModules.requireModule(module);

            if (remoteModule) {
              return remoteModule;
            }
          } catch (error) {
            logger.info(`Providing a deep mock for the '${module}' module.`);
            return createDeepMock(module, logger);
          }
        }
      }
    };
  },
};
