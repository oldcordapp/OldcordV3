import { logger, search } from ".";
import { patch } from "./patch";

let webpackRequire;

export function getRequire() {
  // In Cordwood, it is exported, not sure how useful this would be
  return webpackRequire;
}

export function init() {
  /*
    Webpack Require (wreq below in comments) has a prop named .m that existed since 2015.
    Vencord hook Function.prototype (find any function) to find the m property.
    We just use Vencord's method as it is robust and persist throughout Webpack updates, e.g. webpackJsonp to webpackChunkdiscord_app, webpackJsonp from function to array
    Code derived from Vencord.
  */

  Object.defineProperty(Function.prototype, "m", {
    configurable: true,
    set: function (modules) {
      const potentialWebpackRequire = this;

      /*
        Oldcord turns every file into a blob and for reasons we are not getting of it soon. (We also need to patch the CSS too)
        Vencord's path finding and detecting based of filenames will not work for us here.
      */

      if (!String(potentialWebpackRequire).includes("exports:{}")) {
        return;
      }

      /*
        Despite being turned into a blob, the code itself did not change, and thus in the code it thinks it is running under
        /assets/ on .p, therefore the following code still works under Oldcord.
      */

      Object.defineProperty(potentialWebpackRequire, "p", {
        configurable: true,
        set: function (bundlePath) {
          Object.defineProperty(potentialWebpackRequire, "p", {
            value: bundlePath,
            writable: true,
            configurable: true,
          });

          // The following code is from Vencord

          if (
            bundlePath !== "/assets/" ||
            /(?:=>|{return)"[^"]/.exec(String(this.u))
          ) {
            return;
          }

          if (!webpackRequire && this.c != null) {
            logger.log("Main Discord Webpack require found!");

            // Now we can patch the code

            webpackRequire = potentialWebpackRequire;

            patch("discord", modules);
          }
        },
      });

      Object.defineProperty(potentialWebpackRequire, "m", {
        value: modules,
        configurable: true,
        writable: true,
      });
    },
  });
}
