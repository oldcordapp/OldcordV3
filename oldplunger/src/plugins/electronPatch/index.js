import { Logger } from "../../utils/logger.js";
import windowDiscordNative from "./windowDiscordNative.js";
import windowRequire from "./windowRequire.js";

export const logger = new Logger("Electron Patches");

export function createDeepMock(moduleName, logger) {
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

export let appName = "Oldcord";

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

    try {
      const moduleDataPath =
        await window.DiscordNative.fileManager.getModulePath();
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

    await windowDiscordNative();

    window.require = (moduleName) => {
      return windowRequire(moduleName);
    };
  },
};
