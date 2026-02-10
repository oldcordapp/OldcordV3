import { Router } from 'express';

import dispatcher from '../helpers/dispatcher.ts';
import errors from '../helpers/errors.ts';
import { logText } from '../helpers/logger.ts';
import { channelMiddleware } from '../helpers/middlewares.ts';
import quickcache from '../helpers/quickcache.ts';
import type { Response } from "express";
import { prisma } from '../prisma.ts';
import globalUtils from '../helpers/globalutils.ts';

const router = Router({ mergeParams: true });

router.param('messageid', async (req: any, _res: Response, next, messageid: string) => {
  req.message = await prisma.message.findUnique({
    where: {
      message_id: messageid
    }
  })

  next();
});

router.get('/', channelMiddleware, quickcache.cacheFor(60 * 5, true), async (req: any, res: Response) => {
  try {
    const channel = req.channel;
    const pinned_messages = await prisma.message.findMany({
      where: {
        pinned: true,
        channel_id: channel.id
      }
    });

    const formattedMessages = pinned_messages.map(msg => 
       (msg as any).toPublic((msg as any).author)
    );

    return res.status(200).json(formattedMessages);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.put('/:messageid', channelMiddleware, async (req: any, res: Response) => {
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

    await prisma.message.update({
      where: {
        message_id: req.message.id
      },
      data: {
        pinned: true
      }
    })

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

      const pin_msg = await globalUtils.createSystemMessage(req.guild.id, channel.id, 6, [
        req.account
      ]);

      await dispatcher.dispatchEventInChannel(req.guild, channel.id, 'MESSAGE_CREATE', pin_msg);
    }

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/:messageid', channelMiddleware, async (req: any, res: Response) => {
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

    await prisma.message.update({
      where: {
        message_id: req.message.id
      },
      data: {
        pinned: false
      }
    })

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

router.post('/ack', channelMiddleware, async (req: any, res: Response) => {
  try {
    const userId = req.account.id;
    const channelId = req.channel.id;

    const latestPin = await prisma.message.findFirst({
      where: {
        channel_id: channelId,
        pinned: true,
      },
      orderBy: {
        message_id: 'desc',
      },
      select: {
        message_id: true,
        timestamp: true,
      },
    });

    if (latestPin) {
      const messageId = latestPin.message_id;

      await prisma.acknowledgement.upsert({
        where: {
          user_id_channel_id: {
            user_id: userId,
            channel_id: channelId,
          },
        },
        update: {
          message_id: messageId,
          last_pin_timestamp: latestPin.timestamp,
          timestamp: new Date().toISOString(),
        },
        create: {
          user_id: userId,
          channel_id: channelId,
          message_id: messageId,
          last_pin_timestamp: latestPin.timestamp,
          timestamp: new Date().toISOString(),
          mention_count: 0
        },
      });

      await dispatcher.dispatchEventTo(userId, 'MESSAGE_ACK', {
        channel_id: channelId,
        message_id: messageId,
        manual: true,
      });
    }

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');
    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
