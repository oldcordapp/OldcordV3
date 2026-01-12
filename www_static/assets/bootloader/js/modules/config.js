export const Config = {
  assets_cdn_url: "https://cdn.oldcordapp.com",

  async load() {
    const config = await fetch("/instance").then((r) => r.json());
    return {
      ...config,
      globalEnv: {
        API_ENDPOINT: `//${location.host}/api`,
        API_VERSION: 6,
        GATEWAY_ENDPOINT: config.gateway,
        WEBAPP_ENDPOINT: `//${location.host}`,
        CDN_HOST: `//${location.host}`,
        ASSET_ENDPOINT: config.assets_cdn_url,
        MEDIA_PROXY_ENDPOINT: `//${location.host}`,
        WIDGET_ENDPOINT: "",
        INVITE_HOST: config.custom_invite_url,
        GUILD_TEMPLATE_HOST: location.host,
        GIFT_CODE_HOST: `${location.host}/gifts`,
        RELEASE_CHANNEL: "staging",
        MARKETING_ENDPOINT: "",
        BRAINTREE_KEY: "",
        STRIPE_KEY: "",
        NETWORKING_ENDPOINT: "",
        RTC_LATENCY_ENDPOINT: "",
        ACTIVITY_APPLICATION_HOST: "",
        PROJECT_ENV: "development",
        REMOTE_AUTH_ENDPOINT: "",
        SENTRY_TAGS: {
          buildId: "0",
          buildType: "CLIENT_MOD_PLEASE_IGNORE",
        },
        MIGRATION_SOURCE_ORIGIN: "",
        MIGRATION_DESTINATION_ORIGIN: "",
        HTML_TIMESTAMP: 1724751950316,
        ALGOLIA_KEY: "",
      },
    };
  },
};
