export function webpack() {
    // December 2018 (or maybe earlier) uses Webpack 4 which is an array which we can use modern methods (Moonlight/Vencord).
    // For Webpack 3, in which webpackJsonp is a function, we have to use another way, which is changing args.

    let _webpackJsonp;
    let originalWebpackJsonP;
    let initialized = false;
    window.oldplunger.oldwebpackVersion = 3;
    
    Object.defineProperty(window, "webpackJsonp", {
        set: (Jsonp) => {
            if (initialized) {
                _webpackJsonp = Jsonp;
                return;
            }

            originalWebpackJsonP = Jsonp;

            if (typeof Jsonp == "function") {
                console.log("[Webpack Patcher] Detected Webpack 3. Function wrapping is used.")
                
                _webpackJsonp = function(...args) {
                    const modules = args[1];

                    console.log(modules)
                    
                    if (modules) {
                        console.log(modules);
                    }
                    return originalWebpackJsonP.apply(this, args);
                }

            } else {
                window.oldplunger.webpackVersion = 4;
                console.log("[Webpack Patcher] Detected Webpack 4+. Modern patching is used.")

                // Moonlight's method is used, would want to use Vencord's but I don't think it works for us.
                // Thanks Moonlight!

                const originalPush = Jsonp.push;

                if (Jsonp.push.oldplungerPatched !== true) {
                    Jsonp.push = (items) => {
                        console.log(items[1])

                        return originalPush.apply(originalWebpackJsonP, [items])
                    }
                    Jsonp.push.oldplungerPatched = true;
                }

                _webpackJsonp = Jsonp
            }
        },
        get: () => _webpackJsonp
    })
};
