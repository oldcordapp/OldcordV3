const express = require('express');
const globalUtils = require('../../../helpers/globalutils');
const { logText } = require('../../../helpers/logger');
const router = express.Router();
const quickcache = require('../../../helpers/quickcache');
const errors = require('../../../helpers/errors');

router.get("/", quickcache.cacheFor(60 * 5), async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
        }

        let connectedAccounts = await global.database.getConnectedAccounts(account.id);

        return res.status(200).json(connectedAccounts);
    }
    catch(error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
    }
});

router.delete("/:platform/:connectionid", async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
        }

        let platform = req.params.platform;
        let connectionid = req.params.connectionid;

        let config = globalUtils.config.integration_config.find(x => x.platform == platform);

        if (!config) {
            return res.status(400).json({
                code: 400,
                message: "This platform is not currently supported by Oldcord. Try again later."
            }); //figure this out
        }

        let connection = await global.database.getConnectionById(connectionid);

        if (connection == null) {
            return res.status(404).json(errors.response_404.UNKNOWN_CONNECTION);
        }

        let tryRemove = await global.database.removeConnectedAccount(connection.id);

        if (!tryRemove) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        await global.dispatcher.dispatchEventTo(account.id, "USER_CONNECTIONS_UPDATE", {});

        let connectedAccounts = await global.database.getConnectedAccounts(account.id);

        return res.status(200).json(connectedAccounts);
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
    }
});

router.patch("/:platform/:connectionid", async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT);
        }

        let platform = req.params.platform;
        let connectionid = req.params.connectionid;

        let config = globalUtils.config.integration_config.find(x => x.platform == platform);

        if (!config) {
            return res.status(400).json({
                code: 400,
                message: "This platform is not currently supported by Oldcord. Try again later."
            });
        }

        let connection = await global.database.getConnectionById(connectionid);

        if (connection == null) {
            return res.status(404).json(errors.response_404.UNKNOWN_CONNECTION);
        }

        let tryUpdate = await global.database.updateConnectedAccount(connection.id, req.body.visibility == 1 ? true : false);

        if (!tryUpdate) {
            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }

        await global.dispatcher.dispatchEventTo(account.id, "USER_CONNECTIONS_UPDATE", {});

        let connectedAccounts = await global.database.getConnectedAccounts(account.id);

        return res.status(200).json(connectedAccounts);
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
    }
});

module.exports = router;