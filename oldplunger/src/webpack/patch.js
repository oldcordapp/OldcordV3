import { logger } from ".";

export function patch(instanceType, modules) {
  /*
    Here we patch the Webpack modules based of what modules it is currently working, for now we patch Discord's.
    If we ever need to patch Webpack modules that are not from Discord, modify this.
  */

  if (instanceType !== "discord") {
    return;
  }

  logger.log("Patching Discord's code...");

  console.log(modules);
}
