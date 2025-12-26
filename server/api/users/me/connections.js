const express = require('express');
const globalUtils = require('../../../helpers/globalutils');
const { logText } = require('../../../helpers/logger');
const router = express.Router();
const quickcache = require('../../../helpers/quickcache');

router.get("/", quickcache.cacheFor(60 * 5), async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
        }

        let connectedAccounts = await global.database.getConnectedAccounts(account.id);

        return res.status(200).json(connectedAccounts);
    }
    catch(error) {
        logText(error, "error");

        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        })
    }
});

router.delete("/:platform/:connectionid", async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
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
            return res.status(404).json({
                code: 404,
                message: "Unknown Connection"
            });
        }

        let tryRemove = await global.database.removeConnectedAccount(connection.id);

        if (!tryRemove) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchEventTo(account.id, "USER_CONNECTIONS_UPDATE", {});

        let connectedAccounts = await global.database.getConnectedAccounts(account.id);

        return res.status(200).json(connectedAccounts);
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        })
    }
});

router.patch("/:platform/:connectionid", async (req, res) => {
    try {
        let account = req.account;

        if (account.bot) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
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
            return res.status(404).json({
                code: 404,
                message: "Unknown Connection"
            });
        }

        let tryUpdate = await global.database.updateConnectedAccount(connection.id, req.body.visibility == 1 ? true : false);

        if (!tryUpdate) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchEventTo(account.id, "USER_CONNECTIONS_UPDATE", {});

        let connectedAccounts = await global.database.getConnectedAccounts(account.id);

        return res.status(200).json(connectedAccounts);
    }
    catch (error) {
        logText(error, "error");

        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        })
    }
});

module.exports = router;