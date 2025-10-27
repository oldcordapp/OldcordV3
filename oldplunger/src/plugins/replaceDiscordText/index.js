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
      find: /"en-US":/,
      replacement: [
        {
          global: true,
          match: "Discord",
          replace: "Oldcord",
        },
      ],
    },
    {
      find: "createElement(",
      replacement: [
        {
          global: true,
          match: "Discord",
          replace: "Oldcord",
        },
      ],
    },
    {
      find: "otpauth",
      replacement: [
        {
          global: true,
          match: "Discord",
          replace: "Oldcord",
        },
      ],
    },
  ],
};
