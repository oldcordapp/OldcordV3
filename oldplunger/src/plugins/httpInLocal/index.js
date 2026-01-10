export default {
  target: 'all',
  name: 'http In Local',
  description: 'Disable HTTPS in insecure mode (for local testing)',
  authors: ['Oldcord Team'],
  mandatory: true,
  configurable: false,
  defaultEnabled: false,
  compatibleBuilds: 'all',
  incompatiblePlugins: [],
  debug: false,

  patches: [
    {
      find: /.*/,
      replacement: [
        {
          global: true,
          match: 'https://',
          replace: `${location.protocol}//`,
        },
      ],
    },
  ],
};
