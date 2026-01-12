export default {
  target: 'all',
  name: 'Change URLs',
  description: 'Change Discord related URLs to instance URLs and Oldcord CDN',
  authors: ['Oldcord Team'],
  mandatory: true,
  configurable: false,
  defaultEnabled: false,
  compatibleBuilds: 'all',
  incompatiblePlugins: [],
  debug: false,

  patches() {
    const inviteLink = window.oldcord.config.custom_invite_url
      .replace('https://', '')
      .replace('http://', '');
    const escapedLink = inviteLink.replace(/\./g, '\\.').replace(/\//g, '\\/');

    // We do not modify this part back to a simple array because we can try loading assets from OPFS instead of from CDN in the future which should be dynamic

    return [
      {
        find: /.*/,
        replacement: [
          {
            match: /d3dsisomax34re.cloudfront.net/g,
            replace: location.host,
          },
          {
            match: /status.discordapp.com/g,
            replace: location.host,
          },
          {
            match: /cdn.discordapp.com/g,
            replace: location.host,
          },
          {
            match: /discordcdn.com/g, // ??? DISCORDCDN.COM?!!11
            replace: location.host,
          },
          {
            match: /discord.gg/g,
            replace: escapedLink,
          },
          {
            match: /discordapp.com/g,
            replace: location.host,
          },
          {
            match: /([a-z]+\.)?discord.media/g,
            replace: location.host,
          },
          {
            match: /(.)\.exports=.\.p/g,
            replace: `$1.exports="${window.assets_cdn_url}/assets/"`,
          },
        ],
      },
      {
        find: /"discord:\/\/"/,
        replacement: [
          {
            match: /"discord:\/\/"/,
            replace: `"oldcord://"`,
          },
        ],
      },
    ];
  },
};
