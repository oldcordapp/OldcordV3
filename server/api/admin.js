const express = require('express');
const { logText } = require('../helpers/logger');
const { staffAccessMiddleware } = require('../helpers/middlewares');
const router = express.Router({ mergeParams: true });
const quickcache = require('../helpers/quickcache');
const globalUtils = require('../helpers/globalutils');

//PRIVILEGE: 1 - (JANITOR) [Can only flag things for review], 2 - (MODERATOR) [Can only delete messages, mute users, and flag things for review], 3 - (ADMIN) [Free reign, can review flags, disable users, delete servers, etc], 4 - (INSTANCE OWNER) - [Can add new admins, manage staff, etc]

router.param('userid', async (req, res, next, userid) => {
    req.user = await global.database.getAccountByUserId(userid);
  
    next();
});

router.get("/users/:userid", staffAccessMiddleware(3), async (req, res) => {
    try {
        const userid = req.params.userid;

        if (!userid) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });
        }

        const [userRet, guilds] = await Promise.all([
            global.database.getAccountByUserId(userid),
            global.database.getUsersGuilds(userid)
        ]); //to-do: make a lite function which just gets the name, id, icon from the database - makes no sense fetching the whole guild object then only using like 3 things from it to fetch it later

        if (!userRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });
        }

        const userWithGuilds = {
            ...userRet,
            guilds,
        };

        return res.status(200).json(globalUtils.sanitizeObject(userWithGuilds, 
            ['settings', 'token', 'password', 'disabled_until', 'disabled_reason']
        ));
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.get("/guilds/:guildid", staffAccessMiddleware(3), async (req, res) => {
    try {
        const guildid = req.params.guildid;

        if (!guildid) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        const guildRet = await global.database.getGuildById(guildid);

        if (!guildRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        return res.status(200).json(guildRet);
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

router.delete("/guilds/:guildid", staffAccessMiddleware(3), async (req, res) => {
    try {
        let guildid = req.params.guildid;

        if (!guildid) {
            return res.status(400).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        let guildRet = await global.database.getGuildById(guildid);

        if (!guildRet) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        await global.database.deleteGuild(guildid);

        await global.dispatcher.dispatchEventInGuild(guildRet, "GUILD_DELETE", {
            id: req.params.guildid
        });

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.post("/users/:userid/moderate/disable", staffAccessMiddleware(3), async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });  
        }

        if (user.id === req.account.id) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });
        }

        if (user.disabled_until) {
            return res.status(400).json({
                code: 400,
                message: "User is already disabled."
            }); 
        }

        let until = req.body.disabled_until;

        if (!until) {
            return res.status(400).json({
                code: 400,
                disabled_until: "This field is required."
            });  
        }

        let audit_log_reason = req.body.internal_reason;

        if (!audit_log_reason) {
            return res.status(400).json({
                code: 400,
                internal_reason: "This field is required."
            });
        }

        let tryDisable = await global.database.internalDisableAccount(req.staff_details, req.params.userid, until ?? "FOREVER", audit_log_reason);

        if (!tryDisable) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchLogoutTo(req.params.userid);
        
        return res.status(200).json(tryDisable);
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

router.post("/users/:userid/moderate/delete", staffAccessMiddleware(3), async (req, res) => {
    try {
        let user = req.user;

        if (!user) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });  
        }

        if (user.id === req.account.id) {
            return res.status(404).json({
                code: 404,
                message: "Unknown User"
            });
        }

        let audit_log_reason = req.body.internal_reason;

        if (!audit_log_reason) {
            return res.status(400).json({
                code: 400,
                internal_reason: "This field is required."
            });
        }

        let tryDisable = await global.database.internalDeleteAccount(req.staff_details, req.params.userid, audit_log_reason);

        if (!tryDisable) {
            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
        }

        await global.dispatcher.dispatchLogoutTo(req.params.userid);
        
        return res.status(200).json(tryDisable);
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
          code: 500,
          message: "Internal Server Error"
        });
    }
});

module.exports = router;