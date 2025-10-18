import { Logger } from "../utils/logger";
import { patches as patchesToDo } from "../utils/patch";

// We just import all the plugins that are valid from esbuild
import * as availablePlugins from "./plugins.export.js";

const logger = new Logger("Plugin Manager");

const plugins = {};

export function initializePlugins() {
  logger.log("Initializing plugins...");
  for (const key in availablePlugins) {
    const availablePlugin = availablePlugins[key];

    plugins[availablePlugin.name] = availablePlugin;

    if (availablePlugin.patches) {
      const patches = typeof availablePlugin.patches === 'function' 
        ? availablePlugin.patches() 
        : availablePlugin.patches;

      for (const patch of patches) {
        patchesToDo.push({...patch, plugin: availablePlugin.name})
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
