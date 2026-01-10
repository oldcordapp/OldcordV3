export default {
  target: 'all',
  name: 'Replace "Discord" Text',
  description:
    'Replaces the text "Discord" with either the instance name or "Oldcord" (Options coming soon!)',
  authors: ['Oldcord Team'],
  mandatory: false,
  configurable: true,
  defaultEnabled: true,
  compatibleBuilds: 'all',
  incompatiblePlugins: [],
  debug: true,

  patches: [
    {
      find: /Discord/,
      replacement: [
        {
          find: /(['"])(?:\\.|(?!\1).)*\1/g,
          match: /Discord/g,
          replace: 'Oldcord',
          exclusions: [
            'BetterDiscord',
            '"DiscordTag',
            './Discord',
            'logoDiscord',
            'joinDiscord',
            'browserDiscord',
            'changelog',
            'DISCORD',
            'LOCALAPPDATA',
            'displayName',
          ],
        },
      ],
    },
  ],
};
