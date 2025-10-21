export default {
  target: "all",
  name: "http In Local",
  description: "Disable HTTPS in insecure mode (for local testing)",
  authors: ["Oldcord Team"],
  mandatory: true,
  notChangeable: false,
  defaultEnabled: false,
  compatibleBuilds: "all",
  incompatiblePlugins: [],
  doNotDebug: true,

  patches() {
    return [
      {
        find: /.*/,
        replacement: [
          {
            global: true,
            match: "https://",
            replace: `${location.protocol}//`,
          },
        ],
      },
    ];
  },
};
