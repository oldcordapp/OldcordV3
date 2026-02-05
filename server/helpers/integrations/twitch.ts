import globalUtils from '../globalutils.ts';
import { logText } from '../logger.ts';
const twitchConfig = globalUtils.config.integration_config.find((x) => x.platform == 'twitch');

class Twitch {
  private code: string;

  constructor(code: string) {
    this.code = code;
  }
  async getAccessToken(): Promise<string | null> {
    if (!twitchConfig) return null;

    const form = new FormData();

    form.append('client_id', twitchConfig.client_id);
    form.append('client_secret', twitchConfig.client_secret);
    form.append('code', this.code);
    form.append('grant_type', 'authorization_code');
    form.append('redirect_uri', twitchConfig.redirect_uri);

    const options = {
      method: 'POST',
      body: form,
    };

    try {
      const response: any = await (await fetch('https://id.twitch.tv/oauth2/token', options)).json();

      return response.access_token;
    } catch (error) {
      logText(error, 'error');

      return null;
    }
  }
  async getUser(access_token): Promise<any | null> {
    if (!twitchConfig) return null;

    const options = {
      headers: {
        'Client-ID': twitchConfig.client_id,
        Authorization: `Bearer ${access_token}`,
      },
    };

    try {
      const response: any = await (await fetch('https://api.twitch.tv/helix/users', options)).json();

      return response.data[0];
    } catch (error) {
      logText(error, 'error');

      return null;
    }
  }
}

export default Twitch;
