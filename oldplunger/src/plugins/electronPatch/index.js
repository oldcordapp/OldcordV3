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
  startAt: "Init",

  patches: [
    {
      find: '"devtools-opened"',
      replacement: [
        {
          // Matches the new API one.
          match:
            /if\s*\([^)]+?\)\s*\{[\s\S]+?webContents[\s\S]+?\}\s*else\s*([\s\S]+?\.on\("changed"[\s\S]+?\);)/,
          replace: "$1",
        },
        {
          // For window.require only builds
          match:
            /if\s*\(.*?\.isDesktop\(\)\)\s*\{[\s\S]+?\}\s*else\s*(\{[\s\S]+?\})/,
          replace: "$1",
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

    const ipcListeners = {};

    const fakeIpc = {
      send: (channel, ...args) => {
        if (channel === "MODULE_INSTALL") {
          let moduleName = args[0];
          logger.info(
            `Intercepted IPC 'MODULE_INSTALL' for '${moduleName}'. Shimming with modern 'ensureModule'.`
          );

          if (moduleName == "discord_overlay") {
            logger.info(
              `discord_overlay tried to install, using the modern version discord_overlay2...`
            );
            moduleName = "discord_overlay2";
          }

          window._OldcordNative.nativeModules
            .ensureModule(moduleName)
            .then(() => {
              logger.info(
                `Successfully ensured module '${moduleName}'. Simulating 'MODULE_INSTALLED' IPC event.`
              );
              if (ipcListeners["MODULE_INSTALLED"]) {
                ipcListeners["MODULE_INSTALLED"].forEach((listener) => {
                  listener({}, moduleName, true);
                });
              }
            })
            .catch((err) => {
              logger.error(
                `Failed to ensure module '${moduleName}'. Simulating failed 'MODULE_INSTALLED' IPC event.`,
                err
              );
              if (ipcListeners["MODULE_INSTALLED"]) {
                ipcListeners["MODULE_INSTALLED"].forEach((listener) => {
                  listener({}, moduleName, false);
                });
              }
            });

          return;
        }

        logger.info(
          `IPC Send: ${channel}`,
          ...args.map((arg) => {
            if (typeof arg === "object" && arg !== null) {
              return JSON.stringify(arg);
            }
            return arg;
          })
        );
        try {
          return Reflect.apply(DiscordNative.ipc.send, DiscordNative.ipc, [
            channel,
            ...args,
          ]);
        } catch (err) {
          logger.error(`ipcRenderer.send failed:`, err);
          return undefined;
        }
      },
      on: (channel, listener) => {
        if (channel === "MODULE_INSTALLED") {
          logger.info(
            `Intercepted IPC listener registration for '${channel}'.`
          );
          if (!ipcListeners[channel]) {
            ipcListeners[channel] = [];
          }
          ipcListeners[channel].push(listener);
        }
        return DiscordNative.ipc.on(channel, listener);
      },
      removeListener: (channel, listener) => {
        if (channel === "MODULE_INSTALLED" && ipcListeners[channel]) {
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

    const alreadyShimmed = [];
    const moduleCache = {};

    window.require = (module) => {
      if (moduleCache.hasOwnProperty(module)) {
        return moduleCache[module];
      }

      if (!alreadyShimmed.includes(module)) {
        logger.info(`Shimming module: ${module}`);
        if (module === "discord_voice" || module === "./VoiceEngine") {
          logger.info(
            `Due to old Discord not being happy with modern discord_voice, it is simply mocked for now.`
          );
        }
        alreadyShimmed.push(module);
      }

      let requiredModule;

      switch (module) {
        case "process": {
          requiredModule = window._OldcordNative.process;
          break;
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

          requiredModule = electronShim;
          break;
        }
        case "os": {
          const osShim = {
            ...window._OldcordNative.os,
            release: () => {
              return window._OldcordNative.os.release;
            },
          };

          requiredModule = osShim;
          break;
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

          requiredModule = moduleShim;
          break;
        }
        case "path": {
          const pathShim = {
            join: (...args) => {
              return window._OldcordNative.fileManager.join(...args);
            },
          };
          requiredModule = pathShim;
          break;
        }
        case "net": {
          logger.info(
            "Providing an augmented shim for the 'net' module via discord_rpc."
          );
          const rpcModule =
            window._OldcordNative.nativeModules.requireModule("discord_rpc");

          const originalNet = rpcModule.RPCIPC.net;

          const netShim = {
            ...originalNet,

            createConnection: (pipeName) => {
              logger.info(
                `[net shim] Faking createConnection to pipe: ${pipeName}`
              );

              const fakeSocket = {
                _events: {},
                on: function (event, callback) {
                  this._events[event] = callback;
                  if (event === "error") {
                    setTimeout(() => {
                      this._events.error(new Error("ECONNREFUSED"));
                    }, 0);
                  }
                  return this;
                },
                pause: () => {},
                write: () => {},
                end: () => {},
                destroy: () => {},
              };

              return fakeSocket;
            },
          };

          requiredModule = netShim;
          break;
        }
        case "buffer": {
          logger.info("Providing a shim for the 'buffer' module.");
          const BufferShim = {
            byteLength: (str) => new TextEncoder().encode(str).length,
            alloc: (size) => {
              const arrayBuffer = new ArrayBuffer(size);
              const uint8Array = new Uint8Array(arrayBuffer);
              const dataView = new DataView(arrayBuffer);

              uint8Array.writeInt32LE = (value, offset) => {
                dataView.setInt32(offset, value, true);
              };

              uint8Array.write = (str, offset, length) => {
                const encoded = new TextEncoder().encode(str);
                uint8Array.set(encoded.slice(0, length), offset);
              };

              return uint8Array;
            },
          };

          requiredModule = {
            Buffer: BufferShim,
          };
          break;
        }
        case "http": {
          logger.info(
            "Providing a shim for the 'http' module via discord_rpc."
          );
          const rpcModule =
            window._OldcordNative.nativeModules.requireModule("discord_rpc");
          requiredModule = rpcModule.RPCWebSocket.http;
          break;
        }
        case "querystring": {
          logger.info("Providing a basic shim for the 'querystring' module.");
          requiredModule = {
            parse: (str) => {
              const params = {};
              if (typeof str !== "string" || str.length === 0) {
                return params;
              }
              for (const pair of str.split("&")) {
                const parts = pair.split("=");
                const key = decodeURIComponent(parts[0] || "");
                const value = decodeURIComponent(parts[1] || "");
                if (key) params[key] = value;
              }
              return params;
            },
          };
          break;
        }
        case "discord_rpc": {
          logger.info(
            "Providing a compatibility shim for the 'discord_rpc' module."
          );
          const originalRpc =
            window._OldcordNative.nativeModules.requireModule("discord_rpc");

          const rpcShim = {
            Server: originalRpc.RPCWebSocket.ws.Server,

            Proxy: {
              createProxyServer: () => {
                logger.warn(
                  "[RPC Shim] `Proxy.createProxyServer` was called. This feature is no longer supported and will be mocked to prevent crashes."
                );
                return {
                  web: (...args) => {
                    logger.warn(
                      "[RPC Shim] `proxy.web` was called. Doing nothing."
                    );
                    const res = args[1];
                    if (res && typeof res.writeHead === "function") {
                      try {
                        res.writeHead(501, {
                          "Content-Type": "application/json",
                        });
                        res.end(
                          JSON.stringify({
                            message: "RPC Proxy Not Implemented",
                          })
                        );
                      } catch (e) {
                        logger.error(
                          "Failed to write proxy error response:",
                          e
                        );
                      }
                    }
                  },
                };
              },
            },

            RPCIPC: originalRpc.RPCIPC,
            RPCWebSocket: originalRpc.RPCWebSocket,
          };

          requiredModule = rpcShim;
          break;
        }
        case "./VoiceEngine":
        case "discord_voice": {
          requiredModule = createDeepMock("discord_voice", logger);
          break;
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

          requiredModule = discordUtilsShim;
          break;
        }
        case "erlpack": {
          requiredModule =
            window._OldcordNative.nativeModules.requireModule(
              "discord_erlpack"
            );
          break;
        }
        default: {
          try {
            const remoteModule =
              window._OldcordNative.nativeModules.requireModule(module);

            if (remoteModule) {
              requiredModule = remoteModule;
            }
          } catch (error) {
            logger.info(`Providing a deep mock for the '${module}' module.`);
            requiredModule = createDeepMock(module, logger);
          }
          break;
        }
      }

      moduleCache[module] = requiredModule;
      return requiredModule;
    };
  },
};
