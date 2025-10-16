// If it is possible to put `www_static/bootloader`'s AOT patching AND shimming into Oldplunger instead of deferring to bootloader it would be better.

// Following Vencord's src/Vencord.ts

async function init() {
    console.log("[Oldplunger] Loaded!")
}

init();