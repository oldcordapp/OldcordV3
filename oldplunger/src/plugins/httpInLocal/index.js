export default {
  target: "all",
  name: "http In Local",
  description: "Disable HTTPS in insecure mode (for local testing)",
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
            match: "https://",
            replace: `${location.protocol}//`,
          },
        ],
      },
    ];
  },
};
