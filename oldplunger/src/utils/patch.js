import cookieManager from "./cookieManager";
import { Logger } from "./logger";

const logger = new Logger("Patcher");

const isDebugMode = cookieManager.get("debug_mode");

// I think from Vencord's side this is for plugins to add in their patches

export const patches = [];

// So we also took some code from Vencord here, I guess

export function patchModule(module, id) {
  if (typeof module !== "function") return module;

  // 0, prefix to turn it into an expression: 0,function(){} would be invalid syntax without the 0,
  let moduleString = "0," + String(module);

  for (const patch of patches) {
    if (
      (typeof patch.find === "string" && !moduleString.includes(patch.find)) ||
      (patch.find instanceof RegExp && !patch.find.test(moduleString))
    ) {
      continue;
    }

    const originalModule = module;
    const originalModuleString = moduleString;

    for (const replacement of patch.replacement) {
      if (replacement.match.global) {
        moduleString = moduleString.replaceAll(
          replacement.match,
          replacement.replace
        );
      } else {
        moduleString = moduleString.replace(
          replacement.match,
          replacement.replace
        );
      }
    }

    if (moduleString === originalModuleString) {
      continue;
    }

    try {
      module = (0, eval)(
        `${moduleString}${
          patch.plugin.doNotDebug ||
          isDebugMode !== "true" ||
          moduleString.match("//# sourceURL")
            ? ""
            : "//# sourceURL=oldplunger:///WebpackModule${String(id)}"
        }`
      );
    } catch (e) {
      logger.error(
        `Failed to patch ${id}, ${patch.plugin.name} is causing it.`
      );
      module = originalModule;
      moduleString = originalModuleString;
    }
  }

  return module;
}
