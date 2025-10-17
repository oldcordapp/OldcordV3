function patchModules(instanceType, modules) {
  /*
    Here we patch the Webpack modules based of what modules it is currently working, for now we patch Discord's.
    If we ever need to patch Webpack modules that are not from Discord, modify this.
  */

  if (instanceType !== "discord") {
    return;
  }

  console.log("[Webpack Patcher] Patching Discord's code...");
}

export function patch() {
  /*
    Webpack Require (wreq below in comments) has a prop named .m that existed since 2015.
    Vencord hook Function.prototype (find any function) to find the m property.
    We just use Vencord's method as it is robust and persist throughout Webpack updates, e.g. webpackJsonp to webpackChunkdiscord_app, webpackJsonp from function to array
    Code derived from Vencord.
  */

  Object.defineProperty(Function.prototype, "m", {
    configurable: true,
    set: function (modules) {
      const webpackRequire = this;

      /*
        Oldcord turns every file into a blob and for reasons we are not getting of it soon. (We also need to patch the CSS too)
        Vencord's path finding and detecting based of filenames will not work for us here.
      */

      if (!String(webpackRequire).includes("exports:{}")) {
        return;
      }

      /*
        Despite being turned into a blob, the code itself did not change, and thus in the code it thinks it is running under
        /assets/ on .p, therefore the following code still works under Oldcord.
      */

      Object.defineProperty(webpackRequire, "p", {
        configurable: true,
        set: function (bundlePath) {
          Object.defineProperty(webpackRequire, "p", {
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

          if (!window.oldplunger.webpackRequire && this.c != null) {
            console.log(
              "[Webpack Patcher] Main Discord Webpack require found!"
            );

            // In Cordwood, it is exported, in here, we assign it to a window property, not sure how useful this would be

            window.oldplunger.webpackRequire = webpackRequire;

            // Now we can patch the code

            patchModules("discord", modules);
          }
        },
      });

      Object.defineProperty(webpackRequire, "m", {
        value: modules,
        configurable: true,
        writable: true,
      });
    },
  });
}
