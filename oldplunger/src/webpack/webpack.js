export function webpack() {
  // December 2018 (or maybe earlier) uses Webpack 4 which is an array which we can use modern methods (Moonlight/Vencord).
  // For Webpack 3, in which webpackJsonp is a function, we have to use another way.

  let _webpackJsonp;
  let originalWebpackJsonP;

  window.oldplunger.webpackVersion = "3";

  Object.defineProperty(window, "webpackJsonp", {
    set: (Jsonp) => {
      if (Jsonp.oldplungerPatched) {
        _webpackJsonp = Jsonp;
        return;
      }

      originalWebpackJsonP = Jsonp;

      if (typeof Jsonp == "function") {
        console.log(
          "[Webpack Patcher] Detected Webpack 3. Function wrapping is used."
        );

        _webpackJsonp = function (...args) {
          const modules = args[1];

          console.log(modules);

          if (modules) {
            console.log(modules);
          }
          return originalWebpackJsonP.apply(this, args);
        };

        _webpackJsonp.oldplungerPatched = true;
      } else if (Array.isArray(Jsonp)) {
        window.oldplunger.webpackVersion = "4+";
        console.log(
          "[Webpack Patcher] Detected Webpack 4+. Modern patching is used."
        );

        // Moonlight's method is used, would want to use Vencord's but I don't think it works for us.
        // Thanks Moonlight!

        const originalPush = Jsonp.push;

        Jsonp.push = (items) => {
          console.log(items[1]);

          return originalPush.apply(originalWebpackJsonP, [items]);
        };
        Jsonp.oldplungerPatched = true;

        _webpackJsonp = Jsonp;
      } else {
        _webpackJsonp = Jsonp;
      }
    },
    get: () => _webpackJsonp,
  });
}
