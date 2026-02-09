import { readFileSync } from 'fs';

import { replaceAll } from './utils/globalutils.js';
import { logText } from './utils/logger.ts';

//So SES is the best we got, everything else is quick to block ya - so just use amazon.
// TODO yes so as on the issue#109 please add smtp support :)

class emailer {
  constructor(config, max_per_timeframe, timeframe_ms, ratelimiter_modifier = 5) {
    if (!config.enabled || !config) return;

    this.max_per_timeframe = max_per_timeframe;
    this.timeframe_ms = timeframe_ms;

    this.config = config;

    this.ratelimited = false;
    this.ratelimitedWhen = null;
    this.sentRLNotice = false;
    this.outNumberPerTF = 0;
    this.ratelimiter_modifier = ratelimiter_modifier;

    this.ratelimiter = setInterval(() => {
      if (this.ratelimited && this.ratelimitedWhen != null) {
        this.ratelimited =
          Date.now() - this.ratelimitedWhen >= this.timeframe_ms * this.ratelimiter_modifier;
        this.ratelimitedWhen = !this.ratelimited ? null : this.ratelimitedWhen;
        this.outNumberPerTF = !this.ratelimited ? 0 : this.outNumberPerTF;

        if (!this.ratelimited) {
          logText('Out of configured ratelimit. Able to send e-mails again.', 'EMAILER');

          this.sentRLNotice = false;
        }
      }

      this.ratelimited = this.outNumberPerTF > max_per_timeframe && !this.ratelimited;

      if (this.ratelimited && !this.sentRLNotice) {
        logText(
          `Hit configured e-mail ratelimit - Will be able to send e-mails again in ~${Math.round(this.timeframe_ms * this.ratelimiter_modifier)}ms.`,
          'EMAILER',
        );

        this.sentRLNotice = true;
      }
    }, this.timeframe_ms);
  }
  async trySendEmail(to, subject, content) {
    try {
      if (this.ratelimited) return false;

      if (!this.config.enabled || !this.config) return false;

      const mailOptions = {
        sender: {
          email: this.config.fromAddress,
        },
        to: [
          {
            email: to,
          },
        ],
        subject: subject,
        htmlContent: content,
      };

      const result = await fetch('https://api.brevo.com/v3/smtp/email', {
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config['brevo-api-key'],
        },
        method: 'POST',
        body: JSON.stringify(mailOptions),
      });

      if (!result.ok) return false;

      return true;
    } catch (error) {
      logText(error, 'error');

      return false;
    }
  }
  async sendRegistrationEmail(to, emailToken, account) {
    try {
      let htmlContent = readFileSync('./www_static/assets/emails/verify-email.html', 'utf8');

      htmlContent = replaceAll(htmlContent, '[username]', account.username);
      htmlContent = replaceAll(htmlContent, '[discriminator]', account.discriminator);
      htmlContent = replaceAll(htmlContent, '[instance]', global.config.instance.name);
      htmlContent = replaceAll(htmlContent, '[protocol]', global.config.secure ? 'https' : 'http');
      htmlContent = replaceAll(
        htmlContent,
        '[assets_cdn_url]',
        global.config.assets_cdn_url === '' ? 'cdn.oldcordapp.com' : global.config.assets_cdn_url,
      );
      htmlContent = replaceAll(htmlContent, '[domain]', global.full_url);
      htmlContent = replaceAll(htmlContent, '[ffnum]', '2');
      htmlContent = replaceAll(htmlContent, '[email_token]', emailToken);
      htmlContent = replaceAll(
        htmlContent,
        '[fftext]',
        'The bushes and clouds in the original Super Mario Bros are the same sprite recolored.',
      );
      htmlContent = replaceAll(htmlContent, '[address]', '401 California Dr, Burlingame, CA 94010');

      const res = await global.emailer.trySendEmail(to, 'Verify Email', htmlContent);

      return res;
    } catch (error) {
      logText(error, 'error');

      return false;
    }
  }
  async sendForgotPassword(to, emailToken, account) {
    try {
      let htmlContent = readFileSync(
        './www_static/assets/emails/password-reset-request-for-discord.html',
        'utf8',
      ); //to-do: have variety based on client year

      htmlContent = replaceAll(htmlContent, '[username]', account.username);
      htmlContent = replaceAll(htmlContent, '[discriminator]', account.discriminator);
      htmlContent = replaceAll(htmlContent, '[instance]', global.config.instance.name);
      htmlContent = replaceAll(htmlContent, '[protocol]', global.config.secure ? 'https' : 'http');
      htmlContent = replaceAll(
        htmlContent,
        '[assets_cdn_url]',
        global.config.assets_cdn_url === '' ? 'cdn.oldcordapp.com' : global.config.assets_cdn_url,
      );
      htmlContent = replaceAll(htmlContent, '[domain]', global.full_url);
      htmlContent = replaceAll(htmlContent, '[ffnum]', '2');
      htmlContent = replaceAll(htmlContent, '[email_token]', emailToken);
      htmlContent = replaceAll(
        htmlContent,
        '[fftext]',
        'The bushes and clouds in the original Super Mario Bros are the same sprite recolored.',
      );
      htmlContent = replaceAll(htmlContent, '[address]', '401 California Dr, Burlingame, CA 94010');

      const res = await global.emailer.trySendEmail(
        to,
        `Password Reset Request for ${global.config.instance.name}`,
        htmlContent,
      );

      return res;
    } catch (error) {
      logText(error, 'error');

      return false;
    }
  }
}

export default emailer;
