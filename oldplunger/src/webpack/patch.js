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

      Object.defineProperty(webpackRequire, "p", {
        configurable: true,
        set: function (bundlePath) {
          Object.defineProperty(webpackRequire, "p", {
            value: bundlePath,
            writable: true,
            configurable: true,
          });

          // The following code is from Vencord

          if (bundlePath !== "/assets/" || /(?:=>|{return)"[^"]/.exec(String(this.u))) {
            return;
          }

          if (!window.oldplunger.webpackRequire && this.c != null) {
            console.log(
              "[Webpack Patcher] Main Discord Webpack require found!"
            );
            window.oldplunger.webpackRequire = webpackRequire;
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
