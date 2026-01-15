import { Router } from 'express';
import globalUtils from '../helpers/globalutils';
import { logText } from '../helpers/logger';
import { channelPermissionsMiddleware, rateLimitMiddleware } from '../helpers/middlewares';
import quickcache from '../helpers/quickcache';
import Watchdog from '../helpers/watchdog';
import errors from '../helpers/errors';
import dispatcher from '../helpers/dispatcher';

const router = Router({ mergeParams: false });

router.param('userid', async (req, res, next, userid) => {
  req.user = await global.database.getAccountByUserId(userid);

  next();
});

router.delete(
  ['/:urlencoded/@me', '/:urlencoded/%40me'],
  rateLimitMiddleware(
    global.config.ratelimit_config.removeReaction.maxPerTimeFrame,
    global.config.ratelimit_config.removeReaction.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.removeReaction.maxPerTimeFrame,
    global.config.ratelimit_config.removeReaction.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      let account = req.account;
      let channel = req.channel;

      if (!channel) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let guild = req.guild;

      if (channel.type != 1 && channel.type != 3 && !guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let message = req.message;

      if (!message) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      if (guild && guild.exclusions.includes('reactions')) {
        return res.status(400).json({
          code: 400,
          message: 'Reactions are disabled in this server due to its maximum support',
        });
      }

      let encoded = req.params.urlencoded;
      let dispatch_name = decodeURIComponent(encoded);
      let id = null;

      if (encoded.includes(':')) {
        id = encoded.split(':')[1];
        encoded = encoded.split(':')[0];
        dispatch_name = encoded;
      }

      let tryUnReact = await global.database.removeMessageReaction(
        message,
        account.id,
        id,
        dispatch_name,
      );

      if (!tryUnReact) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      const payload = {
        channel_id: channel.id,
        message_id: message.id,
        user_id: account.id,
        emoji: {
          id: id,
          name: dispatch_name,
        },
      };

      if (guild)
        await dispatcher.dispatchEventInChannel(
          req.guild,
          channel.id,
          'MESSAGE_REACTION_REMOVE',
          payload,
        );
      else
        await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_REACTION_REMOVE', payload);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.delete(
  '/:urlencoded/:userid',
  channelPermissionsMiddleware('MANAGE_MESSAGES'),
  rateLimitMiddleware(
    global.config.ratelimit_config.removeReaction.maxPerTimeFrame,
    global.config.ratelimit_config.removeReaction.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.removeReaction.maxPerTimeFrame,
    global.config.ratelimit_config.removeReaction.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      let user = req.user;

      if (!user) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
      }

      let channel = req.channel;

      if (!channel) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let guild = req.guild;

      if (channel.type != 1 && channel.type != 3 && !guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let message = req.message;

      if (!message) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      if (guild && guild.exclusions.includes('reactions')) {
        return res.status(400).json({
          code: 400,
          message: 'Reactions are disabled in this server due to its maximum support',
        });
      }

      let encoded = req.params.urlencoded;
      let dispatch_name = decodeURIComponent(encoded);
      let id = null;

      if (encoded.includes(':')) {
        id = encoded.split(':')[1];
        encoded = encoded.split(':')[0];
        dispatch_name = encoded;
      }

      let tryUnReact = await global.database.removeMessageReaction(
        message,
        user.id,
        id,
        dispatch_name,
      );

      if (!tryUnReact) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      const payload = {
        channel_id: channel.id,
        message_id: message.id,
        user_id: user.id,
        emoji: {
          id: id,
          name: dispatch_name,
        },
      };

      if (guild)
        await dispatcher.dispatchEventInChannel(
          req.guild,
          channel.id,
          'MESSAGE_REACTION_REMOVE',
          payload,
        );
      else
        await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_REACTION_REMOVE', payload);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.put(
  ['/:urlencoded/@me', '/:urlencoded/%40me'],
  rateLimitMiddleware(
    global.config.ratelimit_config.addReaction.maxPerTimeFrame,
    global.config.ratelimit_config.addReaction.timeFrame,
  ),
  Watchdog.middleware(
    global.config.ratelimit_config.addReaction.maxPerTimeFrame,
    global.config.ratelimit_config.addReaction.timeFrame,
    0.5,
  ),
  async (req, res) => {
    try {
      let account = req.account;
      let channel = req.channel;

      if (!channel) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let guild = req.guild;

      if (channel.type != 1 && channel.type != 3 && !guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
      }

      let message = req.message;

      if (!message) {
        return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
      }

      if (guild && guild.exclusions.includes('reactions')) {
        return res.status(400).json({
          code: 400,
          message: 'Reactions are disabled in this server due to its maximum support',
        });
      }

      let encoded = req.params.urlencoded;
      let dispatch_name = decodeURIComponent(encoded);
      let id = null;

      if (encoded.includes(':')) {
        id = encoded.split(':')[1];
        encoded = encoded.split(':')[0];
        dispatch_name = encoded;
      }

      let reactionKey = JSON.stringify({
        id: id,
        name: dispatch_name,
      });

      if (
        message.reactions.some(
          (x) => x.user_id === account.id && JSON.stringify(x.emoji) === reactionKey,
        )
      ) {
        return res.status(204).send(); //dont dispatch more than once
      }

      let reactionExists = message.reactions.some((x) => JSON.stringify(x.emoji) === reactionKey);

      if (!reactionExists) {
        let canAdd = global.permissions.hasChannelPermissionTo(
          req.channel,
          req.guild,
          req.account.id,
          'ADD_REACTIONS',
        );

        if (!canAdd) {
          return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }
      }

      let tryReact = await global.database.addMessageReaction(message, account.id, id, encoded);

      if (!tryReact) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      const payload = {
        channel_id: channel.id,
        message_id: message.id,
        user_id: account.id,
        emoji: {
          id: id,
          name: dispatch_name,
        },
      };

      if (guild)
        await dispatcher.dispatchEventInChannel(
          req.guild,
          channel.id,
          'MESSAGE_REACTION_ADD',
          payload,
        );
      else await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_REACTION_ADD', payload);

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

router.get('/:urlencoded', quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    let channel = req.channel;

    if (!channel) {
      return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    }

    let guild = req.guild;

    if (channel.type != 1 && channel.type != 3 && !guild) {
      return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    }

    let message = req.message;

    if (!message) {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    if (guild && guild.exclusions.includes('reactions')) {
      return res.status(400).json({
        code: 400,
        message: 'Reactions are disabled in this server due to its maximum support',
      });
    }

    let encoded = req.params.urlencoded;
    let dispatch_name = decodeURIComponent(encoded);
    let id = null;

    if (encoded.includes(':')) {
      id = encoded.split(':')[1];
      encoded = encoded.split(':')[0];
      dispatch_name = encoded;
    }

    let limit = req.query.limit;

    if (limit > 100 || !limit) {
      limit = 100;
    }

    let reactions = message.reactions;

    let filteredReactions = reactions.filter(
      (x) => x.emoji.name == dispatch_name && x.emoji.id == id,
    );

    let return_users = [];

    for (var filteredReaction of filteredReactions) {
      let user = await global.database.getAccountByUserId(filteredReaction.user_id);

      if (user == null) continue;

      return_users.push(globalUtils.miniUserObject(user));
    }

    return res.status(200).json(return_users);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
