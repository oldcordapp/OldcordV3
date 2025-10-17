// If it is possible to put `www_static/bootloader`'s AOT patching AND shimming into Oldplunger instead of deferring to bootloader it would be better.

// Following Vencord's src/Vencord.ts

import * as Webpack from "./webpack";

async function init() {
    window.oldplunger = {};
    Webpack.patch();
    console.log("[Oldplunger] Loaded!")
}

init();