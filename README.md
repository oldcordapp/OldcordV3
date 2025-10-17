![Herple...](/.assets/hurple.png)
<!-- Oldcord: bring back the past -->

# OldcordV3
An open-source reimplementation of the old (2015-2018) Discord backend, including an on-demand client patcher. <br>
Contributions are highly encouraged! We'd love your help to clean and refactor the codebase!

# ⚠️ Important Notices
**Database Migrations**:
   - The database schema can change between updates. When this happens, we will provide SQL migration scripts to upgrade existing databases, **some of these scripts may run automatically on start**.

**Configuration File**:
   - **Always ensure your config.json file matches the structure and entries in config.example.json when you pull new updates.** Instances created before November 14, 2024, must update their configuration file to the new format to function.

**Node.js update**:
   - **If you have your own Oldcord instance before October 5, 2025, please update your Node.js version to either the latest LTS version or the latest version.** This is because of the new Selector update requiring the latest Node.js version to build.

**Help Wanted**! <br>
There are some features we need help with, if you're up for the task, feel free to submit a PR!

- Audit Logs
- Giphy Integration
- The other social media platforms (not just Twitch) for account connections
- Refactor/Improve code
- Full fledged Discord mod to replace the current patching system (Oldplunger)
- If anyone knows how to fix the modals in the main selector screen not playing the exit animation before other modals get mounted we would be happy about it
- Admin panel
- Reworking the existing webhooks implementation & webhook overrides.
  
# Project Status & Features

**Client Year Support**:
  - 🟢 **2015 - 2016**: Full support.
  - 🟠 **2017 - 2018**: In development, mostly supported. (To-dos like giphy support, etc)
  - ❎ **2019+**: No plans for support. Too much commercial crap in these versions, we're focused on preserving the classic Discord experience, completely free from telemetry and bloat.

**Voice & Video**:
  - **Voice**: 🟠 Work in progress, but functional via WebRTC P2P, standard WebRTC (Browser), and UDP (Desktop Client).
      - **Known Issues**: Minor bugs like speaker indicators not showing, firefox not working, or needing to rejoin a call to hear/speak to others are being actively worked on.
      - **Note**: WebRTC requires the "Modernize WebRTC" patch to be enabled in order to work properly. Running Oldcord behind a firewall like Cloudflare would not work well with UDP (affecting both standard WebRTC and Desktop Client) and will disconnect upon joining unless [MediaProxyAgent](https://github.com/oldcordapp/MediaProxyAgent) has been set up and configured in `config.json`.
  - **Video**: 🔴 Not yet supported. Our current focus is on ensuring voice chat works 100% of the time with little to no issues.
  - **Moderation Features**: 🔴Server mute and deafen are planned and actively being worked on.

# Setup Guide
**Prerequisites**:
  - A running PostgreSQL server.
  - Node.js and npm.

**Installation**:
  1. **Setup the Database**: Create a new database via PgAdmin or commandline for PostgreSQL, make sure this database (user & password login as well) matches what's in your future config.json file.
  2. **Install Dependencies**: In the project directory, run the command `npm install`.
  3. **Configure**: Copy `config.example.json` to a new file named `config.json`. Edit the values to match your setup (See the configuration section below for further details).
  4. **Start the Server**: Run the command `npm run start`.

**Configuration** (`config.json`):
  - `custom_invite_url`: Sets the domain for your instance's invite links (e.g., setting it to example.com will make it so every invite has the prefix example.com - similar to discord.gg)
  - `Google reCAPTCHA`: To enable, provide a `site_key`, `secret_key` and change `enabled` to `true`. Do the opposite (`enabled` to `false`) to disable.
     - **IMPORTANT**: The default keys are for demo purposes, **all answers will be marked as valid**, you MUST change these for a production environment.
  - `integration_config`: Manages in-app connections (e.g, Twitch). You'll need to create developer applications on these platforms (like Twitch) to get a `client_id` and `client_secret`.
     ```
       "integration_config" : [{
         "platform" : "twitch",
         "client_id" : "client_id",
         "client_secret" : "client_secret",
         "redirect_uri" : "https://staging.oldcordapp.com/api/connections/twitch/callback"
    }]
    ```
  - `trusted_users`: An array of user IDs that bypass short-term rate limits. Useful for bots.
  - `instance_flags`: An array of strings to enable special features or restrictions:
     - `NO_REGISTRATION`: Blocks new user sign-ups.
     - `NO_GUILD_CREATION`: Prevents users from creating new guilds.
     - `NO_INVITE_USE`: Stops users from joining guilds via invites.
     - `autojoin:GUILDID` - Automatically makes new users join a specific guild upon registration (e.g., `"autojoin:1413791197947867136"`)
  - `gcs_config`: (Optional) Configure automatic asset uploading to Google Cloud Storage. Requires setting up the Google Cloud SDK.
   ```
      "gcs_config": {
         "autoUploadBucket": "your-gcs-bucket-name",
         "gcStorageFolder": "assets"
     }
   ```
   After setting this up, authorize the SDK by running `gcloud auth login` and `gcloud auth application-default login`. You may also need to configure CORS on your bucket.
  - `includePortInUrl`: If set to `false` will force the server to use ports 443/80 instead of the instance port. Good for reverse proxies.
  - `includePortInWsUrl`: If set to `false` will force the server gateway to use ports 443/80 instead of the instance port. Good for reverse proxies.
  - `tenor_api_key`: Needed if you want `/tenor` support. You can get an API key [here](https://tenor.com/developer/dashboard).
  - `auto_embed_urls`: Set to `true` if you want urls included in message content to automatically embed.

 # FAQ
 **What is WebRTC P2P?**
   - WebRTC P2P is a peer-to-peer voice protocol found in 2017-2018 Discord clients. As far as we're aware, it was never officially used, it works by relaying connection data directly between users in a call.
   - Because this protocol is **peer-to-peer**, **it will expose your IP address to other users** in the call. **It is highly recommended to use a VPN with this feature.**

# Acknowledgements
Without these awesome people & resources, Oldcord wouldn't be possible.
  - **ziad87**: Hummus2 source code for token generation, permissions and sessions.
  - **discord.js**: Snowflake implementation.
  - **unkn0w**: Disposable email domain list.
  - **Nebula Entertainment & Broadcasting LLC**: [Nebula Sans font](https://nebulasans.com/) - Drop in replacement for Whitney (Font which Discord used before 2022), used in the bootloader and build selector.
  - **s074 & the Spacebar team**: [WebRTC media server implementation](https://github.com/spacebarchat/mediasoup-webrtc).
  - **Google**: [Material Design Icons](https://fonts.google.com/icons).
  - **SVGRepo**: [Businessman Wearing Tie With Exclamation Mark - Modified for Reports SVG](https://www.svgrepo.com/svg/109813/businessman-wearing-tie-with-exclamation-mark)
  - **Discord**: Other SVGs, images, fonts, etc - for the base clients (before patches) & some parts of Selector/Admin panel. Discord Developer Portal also has documented API responses for this recreation, along with general reverse engineering.
  - **Vencord**: Reference to build Oldplunger.
  - **Cordwood**: Filter/Search functions for Oldplunger.
