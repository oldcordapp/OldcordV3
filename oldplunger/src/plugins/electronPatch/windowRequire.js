import { appName, createDeepMock, logger } from './index.js';

function getNodeModulePaths(startPath, joiner) {
  if (!startPath || !joiner) return [];

  const parts = startPath.split(/\\|\//);
  const paths = [];

  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] === 'node_modules') continue;
    const subParts = parts.slice(0, i + 1);
    const p = joiner.apply(null, subParts);
    paths.push(joiner(p, 'node_modules'));
  }
  return paths;
}

const alreadyShimmed = [];
const moduleCache = {};

export default (moduleName) => {
  if (moduleCache.hasOwnProperty(moduleName)) {
    return moduleCache[moduleName];
  }

  if (!alreadyShimmed.includes(moduleName)) {
    logger.info(`Shimming moduleName: ${moduleName}`);
    if (moduleName === 'discord_voice' || moduleName === './VoiceEngine') {
      logger.info(
        `Due to old Discord not being happy with modern discord_voice, it is simply mocked for now.`,
      );
    }
    alreadyShimmed.push(moduleName);
  }

  let requiredModule;

  switch (moduleName) {
    case 'process': {
      requiredModule = window._OldcordNative.process;
      break;
    }
    case 'electron': {
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
            dock: createDeepMock('electron.remote.app.dock', logger),
            getPath: (...args) => {
              return window._OldcordNative.app.getPathSync(...args);
            },
          },
          getGlobal: (globalVar) => {
            switch (globalVar) {
              case 'releaseChannel': {
                return window._OldcordNative.remoteApp.getReleaseChannel();
              }
              case 'features': {
                return window._OldcordNative.features;
              }
              case 'mainAppDirname': {
                try {
                  const version = window._OldcordNative.app.getVersion();
                  return window._OldcordNative.fileManager.join(
                    window._OldcordNative.process.env.LOCALAPPDATA,
                    appName,
                    `app-${version}`,
                    'resources',
                    'app.asar',
                  );
                } catch (err) {
                  logger.error('Failed to construct mainAppDirname:', err);
                  return undefined;
                }
              }
              case 'crashReporterMetadata': {
                return window._OldcordNative.crashReporter.getMetadata();
              }
              default: {
                logger.warn(
                  `remote.getGlobal could not find a handler for global variable "${globalVar}"`,
                );
                return undefined;
              }
            }
          },
          getCurrentWindow: createWindowShim,
          require: (moduleName) => window.__require(moduleName),
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
        },
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

          return window.__require('electron').remote[prop];
        },
      });

      requiredModule = electronShim;
      break;
    }
    case 'os': {
      const osShim = {
        ...window._OldcordNative.os,
        release: () => {
          return window._OldcordNative.os.release;
        },
      };

      requiredModule = osShim;
      break;
    }
    case 'module': {
      const moduleShim = {
        _nodeModulePaths: (startPath) => {
          if (!startPath) {
            logger.warn("'_nodeModulePaths' called without a start path. Returning empty array.");
            return [];
          }

          return getNodeModulePaths(startPath, window._OldcordNative.fileManager.join);
        },
        globalPaths: [],
      };

      requiredModule = moduleShim;
      break;
    }
    case 'path': {
      const pathShim = {
        join: (...args) => {
          return window._OldcordNative.fileManager.join(...args);
        },
      };
      requiredModule = pathShim;
      break;
    }
    case 'net': {
      logger.info("Providing an augmented shim for the 'net' module via discord_rpc.");
      const rpcModule = window._OldcordNative.nativeModules.requireModule('discord_rpc');

      const originalNet = rpcModule.RPCIPC.net;

      const netShim = {
        ...originalNet,

        createConnection: (pipeName) => {
          logger.info(`[net shim] Faking createConnection to pipe: ${pipeName}`);

          const fakeSocket = {
            _events: {},
            on: function (event, callback) {
              this._events[event] = callback;
              if (event === 'error') {
                setTimeout(() => {
                  this._events.error(new Error('ECONNREFUSED'));
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
    case 'buffer': {
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
    case 'http': {
      logger.info("Providing a shim for the 'http' module via discord_rpc.");
      const rpcModule = window._OldcordNative.nativeModules.requireModule('discord_rpc');
      requiredModule = rpcModule.RPCWebSocket.http;
      break;
    }
    case 'querystring': {
      logger.info("Providing a basic shim for the 'querystring' module.");
      requiredModule = {
        parse: (str) => {
          const params = {};
          if (typeof str !== 'string' || str.length === 0) {
            return params;
          }
          for (const pair of str.split('&')) {
            const parts = pair.split('=');
            const key = decodeURIComponent(parts[0] || '');
            const value = decodeURIComponent(parts[1] || '');
            if (key) params[key] = value;
          }
          return params;
        },
      };
      break;
    }
    case 'discord_rpc': {
      logger.info("Providing a compatibility shim for the 'discord_rpc' module.");
      const originalRpc = window._OldcordNative.nativeModules.requireModule('discord_rpc');

      const rpcShim = {
        Server: originalRpc.RPCWebSocket.ws.Server,

        Proxy: {
          createProxyServer: () => {
            logger.warn(
              '[RPC Shim] `Proxy.createProxyServer` was called. This feature is no longer supported and will be mocked to prevent crashes.',
            );
            return {
              web: (...args) => {
                logger.warn('[RPC Shim] `proxy.web` was called. Doing nothing.');
                const res = args[1];
                if (res && typeof res.writeHead === 'function') {
                  try {
                    res.writeHead(501, {
                      'Content-Type': 'application/json',
                    });
                    res.end(
                      JSON.stringify({
                        message: 'RPC Proxy Not Implemented',
                      }),
                    );
                  } catch (e) {
                    logger.error('Failed to write proxy error response:', e);
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
    case './VoiceEngine':
    case 'discord_voice': {
      requiredModule = createDeepMock('discord_voice', logger);
      break;
    }
    case 'erlpack': {
      requiredModule = window._OldcordNative.nativeModules.requireModule('discord_erlpack');
      break;
    }
    default: {
      requiredModule = window._OldcordNative.nativeModules.requireModule(moduleName);
    }
  }

  moduleCache[moduleName] = requiredModule;
  return requiredModule;
};
