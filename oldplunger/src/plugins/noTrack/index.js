export default {
  target: "all",
  name: "No Track",
  description: "Disable Sentry and Science (in progress)",
  authors: ["Oldcord Team"],
  mandatory: true,
  configurable: false,
  defaultEnabled: false,
  compatibleBuilds: "all",
  incompatiblePlugins: [],
  debug: false,

  patches: [
    {
      find: /.*/,
      replacement: [
        {
          global: true,
          match: "sentry.io",
          replace: "0.0.0.0",
        },
      ],
    },
  ],
};
