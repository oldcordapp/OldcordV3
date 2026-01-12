const express = require('express');
const globalUtils = require('../../helpers/globalutils');
const config = globalUtils.config;
const router = express.Router();

router.get('/instance/domains', (req, res) => {
  res.json({
    cdn: `${config.secure ? 'https://' : 'http://'}${global.full_url}`, //for user uploaded attachments
    gateway: globalUtils.generateGatewayURL(req),
    defaultApiVersion: '6',
    apiEndpoint: `${config.secure ? 'https://' : 'http://'}${global.full_url}/api`,
  });
});

router.get('/instance/config', (req, res) => {
  res.json({
    limits_user_maxGuilds: null,
    limits_user_maxBio: null,
    limits_guild_maxEmojis: null,
    limits_guild_maxRoles: null,
    limits_message_maxCharacters: null,
    limits_message_maxAttachmentSize: null,
    limits_message_maxEmbedDownloadSize: null,
    limits_channel_maxWebhooks: null,
    register_dateOfBirth_requiredc: null,
    register_password_required: null,
    register_disabled: null,
    register_requireInvite: null,
    register_allowNewRegistration: null,
    register_allowMultipleAccounts: null,
    guild_autoJoin_canLeave: null,
    guild_autoJoin_guilds_x: null,
    register_email_required: null,
    can_recover_account: null,
  });
});

module.exports = router;
