export default {
  target: 'all',
  name: 'Unrestricted Emojis',
  description: 'Allows using emojis anywhere without restrictions',
  authors: ['Oldcord Team'],
  mandatory: false,
  configurable: true,
  defaultEnabled: true,
  compatibleBuilds: 'all',
  incompatiblePlugins: [],
  debug: false,

  patches: [
    {
      find: /isEmojiDisabled:function/,
      replacement: [
        {
          match: /isEmojiDisabled:function\([^)]*\){/,
          replace: '$&return false;',
        },
        {
          global: true,
          match: /=t.invalidEmojis/g,
          replace: '=[]',
        },
      ],
    },
  ],
};
