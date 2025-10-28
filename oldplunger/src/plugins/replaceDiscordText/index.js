export default {
  target: "all",
  name: 'Replace "Discord" Text',
  description:
    'Replaces the text "Discord" with either the instance name or "Oldcord" (Options coming soon!)',
  authors: ["Oldcord Team"],
  mandatory: false,
  configurable: true,
  defaultEnabled: true,
  compatibleBuilds: "all",
  incompatiblePlugins: [],
  debug: true,

  patches: [
    {
      find: /(['"])(.*?)(\1)/,
      replacement: [
        {
          match: /(\w*)Discord(\w*)/g,
          replace: "$1Oldcord$2",
        },
      ],
    }
  ],
};
