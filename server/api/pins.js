import { Router } from 'express';

import dispatcher from '../helpers/dispatcher.js';
import errors from '../helpers/consts/errors.js';
import { logText } from '../helpers/logger.ts';
import { channelMiddleware } from '../helpers/middlewares.js';
import quickcache from '../helpers/quickcache.js';

const router = Router({ mergeParams: true });

router.param('messageid', async (req, res, next, messageid) => {
  req.message = await global.database.getMessageById(messageid);

  next();
});

router.get('/', channelMiddleware, quickcache.cacheFor(60 * 5, true), async (req, res) => {
  try {
    const channel = req.channel;
    const pinned_messages = await global.database.getPinnedMessagesInChannel(channel.id);

    return res.status(200).json(pinned_messages);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.put('/:messageid', channelMiddleware, async (req, res) => {
  try {
    const channel = req.channel;
    const message = req.message;

    if (!message) {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    if (message.pinned) {
      //should we tell them?

      return res.status(204).send();
    }

    const tryPin = await global.database.setPinState(req.message.id, true);

    if (!tryPin) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    message.pinned = true;

    if (channel.type == 1 || channel.type == 3) {
      await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_UPDATE', message);
      await dispatcher.dispatchEventInPrivateChannel(channel, 'CHANNEL_PINS_UPDATE', {
        channel_id: channel.id,
        last_pin_timestamp: new Date().toISOString(),
      });

      const pin_msg = await global.database.createSystemMessage(null, channel.id, 6, [req.account]);

      await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_CREATE', pin_msg);
    } else {
      await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'MESSAGE_UPDATE', message);
      await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'CHANNEL_PINS_UPDATE', {
        channel_id: channel.id,
        last_pin_timestamp: new Date().toISOString(),
      });

      const pin_msg = await global.database.createSystemMessage(req.guild.id, channel.id, 6, [
        req.account,
      ]);

      await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'MESSAGE_CREATE', pin_msg);
    }

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/:messageid', channelMiddleware, async (req, res) => {
  try {
    const channel = req.channel;
    const message = req.message;

    if (!message) {
      return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
    }

    if (!message.pinned) {
      //should we tell them?

      return res.status(204).send();
    }

    const tryPin = await global.database.setPinState(req.message.id, false);

    if (!tryPin) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    message.pinned = false;

    if (channel.type == 1 || channel.type == 3)
      await dispatcher.dispatchEventInPrivateChannel(channel, 'MESSAGE_UPDATE', message);
    else await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'MESSAGE_UPDATE', message);

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/ack', channelMiddleware, async (req, res) => {
  try {
    const latest_pin = await global.database.getLatestPinAcknowledgement(
      req.account.id,
      req.channel.id,
    );

    if (latest_pin) {
      const tryAck = await global.database.acknowledgeMessage(
        req.account.id,
        req.channel.id,
        latest_pin.id,
        0,
        new Date().toISOString(),
      );

      if (!tryAck) throw 'Message acknowledgement failed';

      await dispatcher.dispatchEventTo(req.account.id, 'MESSAGE_ACK', {
        channel_id: req.channel.id,
        message_id: latest_pin.id,
        manual: true, //They clicked on the channel pins to trigger this
      });
    }

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
