function getEnabledPatches() {
  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith("enabled_patches="));
  if (!cookie) return [];
  try {
    return JSON.parse(decodeURIComponent(cookie.split("=")[1]));
  } catch {
    return [];
  }
}

const patcher = {
  css(css) {
    css = css
      .replaceAll(/d3dsisomax34re.cloudfront.net/g, location.host)
      .replaceAll(/url\(\/assets\//g, `url(${cdn_url}/assets/`)

    // User select patch for 2015 if enabled
    if (
      getEnabledPatches().includes("userSelect") &&
      release_date.endsWith("_2015")
    ) {
      css = css.replaceAll(
      /-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;/g,
      ""
      );
      css = css.replaceAll(/-webkit-user-select:none;/g, "");
      css = css.replaceAll(/user-select:none;/g, "");
      css = css.replaceAll(/-moz-user-select:none;/g, "");
      css = css.replaceAll(/-ms-user-select:none;/g, "");
    }

    css += "\n/* Oldcord Patched */";
    return css;
  },

  js(script, kind, config) {
    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
    }

    // Fix client misidentification
    script = script.replace("__[STANDALONE]__", "");

    // Apply patches conditionally based on enabled state
    if (!release_date.endsWith("_2018") && !release_date.endsWith("_2019")) {
      function sanitize(js) {
        return js.replaceAll(/"/g, '"').replaceAll(/\n|\r/g, "");
      }
      script = script.replaceAll(
        /\"Discord\"|'Discord'/g,
        `"${sanitize(config.instance.name)}"`
      );
    }

    // Disable HTTPS in insecure mode (for local testing)
    if (location.protocol != "https")
      script = script.replaceAll("https://", location.protocol + "//");

    // Make fields consistent
    if (release_date.endsWith("_2015"))
      script = script.replaceAll(".presence.", ".presences.");

    // Set URLs
    script = script.replaceAll(/d3dsisomax34re.cloudfront.net/g, location.host);
    script = script.replaceAll(/status.discordapp.com/g, location.host);
    script = script.replaceAll(/cdn.discordapp.com/g, location.host);
    script = script.replaceAll(/discordcdn.com/g, location.host); // ??? DISCORDCDN.COM?!!11
    script = script.replaceAll(/discord.gg/g, config.custom_invite_url);
    script = script.replaceAll(/discordapp.com/g, location.host);
    script = script.replaceAll(/([a-z]+\.)?discord.media/g, location.host);

    script = script.replaceAll(
      /e\.exports=n\.p/g,
      `e.exports="${cdn_url}/assets/"`
    );

    // Do NOT interact with sentry. Better to error than send telemetry.
    script = script.replaceAll("sentry.io", "0.0.0.0");

    // Use unified UserSearch worker script
    window.userSearchWorker = function (url) {
      const wwScript = `importScripts("${cdn_url}/assets/UserSearch.worker.js");`;
      return URL.createObjectURL(
        new Blob([wwScript], { type: "text/javascript" })
      );
    };
    script = script.replace(
      /n\.p\+"[a-z0-9]+\.worker\.js"/,
      `window.userSearchWorker()`
    );

    // Enable april fools @someone experiment
    if (release_date == "april_1_2018" || release_date == "april_23_2018")
      script = script.replaceAll(
        "null!=e&&e.bucket!==f.ExperimentBuckets.CONTROL",
        "true"
      );

    // Allow emojis anywhere if patch enabled
    if (getEnabledPatches().includes("emojiAnywhere")) {
      script = script.replace(
        /isEmojiDisabled:function\([^)]*\){/,
        "$&return false;"
      );
      script = script.replaceAll(/=t.invalidEmojis/g, "=[]");
    }

    // Recaptcha support
    if (config.captcha_options.enabled)
      script = script.replaceAll(
        "6Lef5iQTAAAAAKeIvIY-DeexoO3gj7ryl9rLMEnn",
        config.captcha_options.site_key
      );

    // Disable telemetry
    script = script.replace(/track:function\([^)]*\){/, "$&return;");
    script = script.replace(
      /(function \w+\(e\)){[^p]*post\({.*url:\w\.Endpoints\.TRACK[^}]*}\)}/,
      "$1{}"
    );
    script = script.replace(
      /return \w\["default"\]\.post\(.*url:\w\.Endpoints\.TRACK[^}]*}[^)]*?\)/g,
      "null;"
    );
    script = script.replace(
      /\w\["default"\]\.post\(.*url:\w\.Endpoints\.TRACK[^}]*}[^)]*?\)/g,
      ""
    );
    script = script.replace(
      /t\.analyticsTrackingStoreMaker=function\(e\){/,
      "t.analyticsTrackingStoreMaker=function(e){return;"
    );

    // Replace text
    function replaceMessage(name, oldValue, value) {
      script = script.replaceAll(
        new RegExp(`${name}:".*?"`, "g"),
        `${name}:"${value}"`
      );
      if (oldValue)
        script = script.replaceAll(
          new RegExp(`"${oldValue}"`, "gi"),
          `"${value}"`
        );
    }
    replaceMessage("FORM_LABEL_SERVER_REGION", "Server Region", "Server Era");
    replaceMessage(
      "ONBOARDING_GUILD_SETTINGS_SERVER_REGION",
      "Server Region",
      "Server Era"
    );
    replaceMessage("REGION_SELECT_HEADER", null, "Select a server era");
    replaceMessage(
      "REGION_SELECT_FOOTER",
      null,
      "Select which year was this server is created for. The features enabled in the server will be limited to this year."
    );
    replaceMessage("NOTIFICATION_TITLE_DISCORD", null, "Oldcord");

    // Custom flags patch
    if (!release_date.endsWith("_2015")) {
      script = script.replace(
        /("\.\/sydney\.png".*?e\.exports=)\w/,
        "$1(f)=>`${window.cdn_url}/flags/${f.substring(2)}`"
      );
    }

    // Remove useless unknown-field error
    if (kind == "root")
      script = script.replace(
        "if(!this.has(e))throw new Error('",
        "if(!this.has(e))return noop('"
      );

    // Electron patches if enabled
    if (window.DiscordNative) {
      // Polyfilling Desktop Native API on <April 2018  (Not entirely complete!)
      if (
        release_date.endsWith("_2015") ||
        release_date.endsWith("_2016") ||
        release_date.endsWith("_2017") ||
        (release_date.endsWith("_2018") &&
          (release_date.startsWith("january") ||
            release_date.startsWith("february") ||
            release_date.startsWith("march")))
      ) {
        script = script.replace(
          /\/\^win\/\.test\(this\.platform\)/,
          "/^win/.test(window.DiscordNative.process.platform)"
        );
        script = script.replace(
          /"darwin"===this.platform/,
          `"darwin"===window.DiscordNative.process.platform`
        );
        script = script.replace(
          /"linux"===this.platform/,
          `"linux"===window.DiscordNative.process.platform`
        );
        script = script.replaceAll(
          /(\w)=\w\?\w.remote.require\(".\/Utils"\):null/g,
          `$1=window.DiscordNative?window.DiscordNative.nativeModules.requireModule("discord_utils"):null`
        );
        script = script.replaceAll(
          /return (\w)\?(\w).remote\[(\w)\]:(\w)\[(\w)\]/g,
          ""
        ); // Stubbing
        script = script.replaceAll(
          /this\.require\(".\/VoiceEngine",!0\)/g,
          `window.DiscordNative.nativeModules.requireModule("discord_voice")`
        );
        script = script.replace(
          /(\w)\.isMaximized\(\)\?\w\.unmaximize\(\):\w\.maximize\(\)/,
          `$1.maximize()`
        );
        script = script.replace(
          /window.__require\?"Discord Client"/,
          `window.DiscordNative?"Discord Client"`
        );
        script = script.replaceAll(
          /\w\.remote\.getCurrentWindow\(\)/g,
          `window.DiscordNative.window`
        );
        script = script.replaceAll(
          /\w\.remote\.require\((\w)\)/g,
          "window.DiscordNative.nativeModules.requireModule($1)"
        );
      }

      // Polyfill botches for specific builds
      if (
        release_date.endsWith("_2016") ||
        (release_date.startsWith("january") && release_date.endsWith("_2017"))
      ) {
        script = script.replace(
          /\w\.setObservedGamesCallback/,
          `window.DiscordNative.nativeModules.requireModule("discord_utils").setObservedGamesCallback`
        );
        script = script.replaceAll(
          /var (\w+)=\w\["default"\]\.requireElectron\("powerMonitor",!0\);/g,
          `var $1=window.DiscordNative.powerMonitor;`
        );
        script = script.replace(
          /var \w=\w\["default"\]\._getCurrentWindow\(\)\.webContents;\w\.removeAllListeners\("devtools-opened"\),\w\.on\("devtools-opened",function\(\){return\(0,\w\.consoleWarning\)\(\w\["default"\]\.Messages\)}\)/,
          ""
        );
      }
      if (
        (release_date.endsWith("_2017") &&
          !release_date.startsWith("january")) ||
        (release_date.endsWith("_2018") &&
          (release_date.startsWith("january") ||
            release_date.startsWith("february") ||
            release_date.startsWith("march")))
      ) {
        script = script.replaceAll(
          /this\.getDiscordUtils\(\)/g,
          `window.DiscordNative.nativeModules.requireModule("discord_utils")`
        );
        script = script.replaceAll(
          /\w\.default\.requireElectron\("powerMonitor",!0\)/g,
          `window.DiscordNative.powerMonitor`
        );
        script = script.replaceAll(
          /this\.requireElectron\("powerMonitor",!0\)/g,
          `window.DiscordNative.powerMonitor`
        );
        script = script.replace(
          /var \w=\w\.default\._getCurrentWindow\(\)\.webContents;\w\.removeAllListeners\("devtools-opened"\),\w\.on\("devtools-opened",function\(\){return\(0,\w\.consoleWarning\)\(\w\.default\.Messages\)}\)/,
          ""
        );
      }

      // Desktop Native API fix for 2018+ (Not entirely complete!)
      if (release_date.endsWith("_2018")) {
        script = script.replace(
          /(\w)\.globals\.releaseChannel/,
          "$1.app.getReleaseChannel()"
        );
        script = script.replace(/(\w)\.globals\.features/, "$1.features");
        script = script.replace(/(\w)\.globals\[(\w)\]/, "$1[$2]");
        script = script.replace(
          /return \w\.removeAllListeners\("devtools-opened"\),\w\.on\("devtools-opened",function\(\){\w\.emit\("devtools-opened"\)}\),\w/,
          ""
        );
        script = script.replace(
          /var \w=\w\.default\.window\.webContents;\w\.removeAllListeners\("devtools-opened"\),\w\.on\("devtools-opened",function\(\){return\(0,\w\.consoleWarning\)\(\w\.default\.Messages\)}\)/,
          ""
        );
        script = script.replace(
          /return \w\.default\.ensureModule\("discord_spellcheck"\)\.then\(function\(\){var \w=\w.default.requireModule\("discord_spellcheck"\)\.Spellchecker,\w=new \w\(new \w\);return function\(\w\){null!=document\.body&&document\.body\.addEventListener\("input",function\(\w\){null!=\w\.target&&"string"==typeof \w\.target.value&&e.detectLocale\(\w\.target\.value\)},!0\)}\(\w\),\w}\)/,
          ""
        );
      }
    }

    // Electron compatibility (Universal)
    script = script.replaceAll(/"discord:\/\/"/g, `"oldcord://"`);

    if (release_date.endsWith("_2019")) {
      // Lazily fix 2019. We don't implement user affinities.
      script = script.replaceAll(
        "f.default.getUserAffinitiesUserIds().has(t.id)",
        "false"
      );
      script = script.replaceAll(/\w\.userAffinties/g, "[]");
    }

    // Remove VIDEO_PROVIDER_CHECK_UNIX_TIMESTAMP hack
    script = script.replace("1492472454139", "0");

    script = script.replaceAll(/d3dsisomax34re.cloudfront.net/g, location.host);
    script = script.replaceAll(/discord.media/g, location.host);
    script = script.replaceAll(/cdn.discordapp.com/g, location.host);

    // Just for visual verification that it is patched by Oldcord LMAO
    script += "\n//Oldcord Patched";

    return script;
  },
};

export { patcher };
