import cookieManager from "../utils/cookieManager.js";
import { Logger } from "../utils/logger";
import { patches as patchesToDo } from "../utils/patch";

// We just import all the plugins that are valid from esbuild
import * as availablePlugins from "./plugins.export.js";

const logger = new Logger("Plugin Manager");

const plugins = {};

export function initializePlugins() {
  logger.log("Initializing plugins...");
  for (const key in availablePlugins) {
    let canInitializePlugin = true;

    const availablePlugin = availablePlugins[key];

    if (!JSON.parse(cookieManager.get("enabled_plugins")).includes(key)) {
      canInitializePlugin = false;
    }

    if (
      (window.location.pathname.includes("developers") &&
        availablePlugin.target === "client") ||
      (!window.location.pathname.includes("developers") &&
        availablePlugin.target === "developerPortal")
    ) {
      canInitializePlugin = false;
    }

    if (!window.DiscordNative && availablePlugin.target === "electron") {
      canInitializePlugin = false;
    }

    if (!canInitializePlugin) {
      continue;
    }

    plugins[availablePlugin.name] = availablePlugin;

    if (availablePlugin.patches) {
      const patches =
        typeof availablePlugin.patches === "function"
          ? availablePlugin.patches()
          : availablePlugin.patches;

      for (const patch of patches) {
        patchesToDo.push({
          ...patch,
          plugin: {
            name: availablePlugin.name,
            doNotDebug: availablePlugin.doNotDebug,
          },
        });
      }
    }
  }
}

export function startPlugins() {
  logger.log("Starting all plugins...");
  for (const name in plugins) {
    const plugin = plugins[name];
    if (plugin.start) {
      try {
        plugin.start();
      } catch (e) {
        logger.error(`Failed to start plugin: ${name}`, e);
      }
    }
  }
}
