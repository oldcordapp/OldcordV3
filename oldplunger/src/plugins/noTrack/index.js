export default {
  target: "all",
  name: "No Track",
  description: "Disable Sentry and Science (in progress)",
  authors: ["Oldcord Team"],
  mandatory: true,
  notChangeable: false,
  defaultEnabled: true,
  compatibleBuilds: "all",
  incompatiblePlugins: [],
  doNotDebug: false,

  patches() {
    return [
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
    ];
  },
};
