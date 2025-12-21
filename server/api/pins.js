const express = require('express');
const { logText } = require('../helpers/logger');
const messages = require('./messages');
const webhooks = require("./webhooks");
const { channelPermissionsMiddleware, rateLimitMiddleware, guildPermissionsMiddleware, channelMiddleware } = require('../helpers/middlewares');
const globalUtils = require('../helpers/globalutils');
const router = express.Router({ mergeParams: true });
const config = globalUtils.config;
const quickcache = require('../helpers/quickcache');

router.param('messageid', async (req, res, next, messageid) => {
    req.message = await global.database.getMessageById(messageid);

    next();
});

router.get("/", channelMiddleware, quickcache.cacheFor(60 * 5, true), async (req, res) => {
    try {
        let channel = req.channel;
        let pinned_messages = await global.database.getPinnedMessagesInChannel(channel.id);

        return res.status(200).json(pinned_messages);
    }  catch(error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.put("/:messageid", channelMiddleware, async (req, res) => {
    try {
        let channel = req.channel;
        let message = req.message;

        if (!message) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Message"
            });
        }

        if (message.pinned) {
            //should we tell them?

            return res.status(204).send();
        }

        let tryPin = await global.database.setPinState(req.message.id, true);

        if (!tryPin) {
            return res.status(500).json({
              code: 500,
              message: "Internal Server Error"
            }); 
        }

        message.pinned = true;

        if (channel.type == 1 || channel.type == 3)
        {
            await global.dispatcher.dispatchEventInPrivateChannel(channel, "MESSAGE_UPDATE", message);
            await global.dispatcher.dispatchEventInPrivateChannel(channel, "CHANNEL_PINS_UPDATE", {
                channel_id: channel.id,
                last_pin_timestamp: new Date().toISOString()
            });

            let pin_msg = await global.database.createSystemMessage(null, channel.id, 6, [req.account]);

            await global.dispatcher.dispatchEventInPrivateChannel(channel, "MESSAGE_CREATE", pin_msg);
        }
        else
        {
            await global.dispatcher.dispatchEventInChannel(req.guild, channel.id, "MESSAGE_UPDATE", message);
            await global.dispatcher.dispatchEventInChannel(req.guild, channel.id, "CHANNEL_PINS_UPDATE", {
                channel_id: channel.id,
                last_pin_timestamp: new Date().toISOString()
            });

            let pin_msg = await global.database.createSystemMessage(req.guild.id, channel.id, 6, [req.account]);

            await global.dispatcher.dispatchEventInChannel(req.guild, channel.id, "MESSAGE_CREATE", pin_msg);
        }

        return res.status(204).send();
    } catch(error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.delete("/:messageid", channelMiddleware, async (req, res) => {
    try {
        let channel = req.channel;
        let message = req.message;

        if (!message) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Message"
            });
        }

        if (!message.pinned) {
            //should we tell them?

            return res.status(204).send();
        }

        let tryPin = await global.database.setPinState(req.message.id, false);

        if (!tryPin) {
            return res.status(500).json({
              code: 500,
              message: "Internal Server Error"
            }); 
        }

        message.pinned = false;

        if (channel.type == 1 || channel.type == 3)
            await global.dispatcher.dispatchEventInPrivateChannel(channel, "MESSAGE_UPDATE", message);
        else
            await global.dispatcher.dispatchEventInChannel(req.guild, channel.id, "MESSAGE_UPDATE", message);

        return res.status(204).send();
    } catch(error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

module.exports = router;