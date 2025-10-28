import cookieManager from "./cookieManager";
import { Logger } from "./logger";

const logger = new Logger("Patcher");

const isDebugMode = cookieManager.get("debug_mode");

// I think from Vencord's side this is for plugins to add in their patches

export const patches = [];

// So we also took some code from Vencord here, I guess

function addBypassEvalTypeError(moduleId, moduleString, patch) {
  const bodyStartIndex = moduleString.indexOf("{") + 1;
  const bodyEndIndex = moduleString.lastIndexOf("}");

  if (bodyStartIndex > 0 && bodyEndIndex > bodyStartIndex) {
    const functionHeader = moduleString.substring(0, bodyStartIndex);
    const originalBody = moduleString.substring(bodyStartIndex, bodyEndIndex);
    const functionFooter = moduleString.substring(bodyEndIndex);

    const newBody = `try { ${originalBody} } catch (err) { console.error('[Patcher] Runtime error in patched module ${String(
      moduleId
    )} from plugin ${patch.plugin.name}:', err); }`;

    moduleString = functionHeader + newBody + functionFooter;
  }

  return moduleString;
}

function callbackReplacer(replacements, args) {
  let fullMatch = args[0];
  const offset = args[args.length - 2];
  const originalString = args[args.length - 1];
  for (const replacement of replacements) {
    if (
      replacement.exclusions.some(
        (exclusion) =>
          fullMatch.includes(exclusion) ||
          originalString
            .substring(Math.max(0, offset - 50), offset)
            .trimEnd()
            .includes(exclusion)
      )
    ) {
      continue;
    }
    if (replacement.match.global || replacement.global) {
      fullMatch = fullMatch.replaceAll(replacement.match, replacement.replace);
    } else {
      fullMatch = fullMatch.replace(replacement.match, replacement.replace);
    }
  }

  return fullMatch;
}

export function patchModule(module, id) {
  if (typeof module !== "function") return module;

  // 0, prefix to turn it into an expression: 0,function(){} would be invalid syntax without the 0,
  let moduleString = "0," + String(module);
  let bypassApplied = false;

  for (const patch of patches) {
    if (
      (typeof patch.find === "string" && !moduleString.includes(patch.find)) ||
      (patch.find instanceof RegExp && !patch.find.test(moduleString))
    ) {
      continue;
    }

    const originalModule = module;
    const originalModuleString = moduleString;

    if (patch.useCallback) {
      moduleString = moduleString.replace(patch.find, (...args) =>
        callbackReplacer(patch.replacement, args)
      );
    } else {
      for (const replacement of patch.replacement) {
        if (replacement.match.global || replacement.global) {
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
    }

    if (moduleString === originalModuleString) {
      continue;
    }

    if (moduleString.includes("[Patcher] Runtime error in patched module")) {
      bypassApplied = true;
    }

    if (patch.plugin.bypassEvalTypeError && !bypassApplied) {
      const newModuleString = addBypassEvalTypeError(id, moduleString, patch);

      if (newModuleString !== moduleString) {
        moduleString = newModuleString;
        bypassApplied = true;
      }
    }

    try {
      module = (0, eval)(
        `${moduleString}${
          !patch.plugin.debug ||
          isDebugMode !== "true" ||
          moduleString.includes("//# sourceURL")
            ? ""
            : `//# sourceURL=oldplunger:///WebpackModule${String(id)}`
        }`
      );
    } catch (e) {
      logger.error(
        `Failed to patch ${id}, ${patch.plugin.name} is causing it.`
      );
      module = originalModule;
      moduleString = originalModuleString;
    }

    bypassApplied = false;
  }

  return module;
}
