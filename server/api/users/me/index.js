const express = require('express');
const globalUtils = require('../../../helpers/globalutils');
const { rateLimitMiddleware, guildMiddleware } = require('../../../helpers/middlewares');
const { logText } = require('../../../helpers/logger');
const router = express.Router();
const relationships = require('../relationships');
const quickcache = require('../../../helpers/quickcache');
const Watchdog = require('../../../helpers/watchdog');
const connections = require('./connections');
const guilds = require('./guilds');
const billing = require('./billing');
const errors = require('../../../helpers/errors');

router.use("/relationships", relationships);

router.param('userid', async (req, res, next, userid) => {
  req.user = await global.database.getAccountByUserId(userid);

  next();
});

router.param('guildid', async (req, _, next, guildid) => {
    req.guild = await global.database.getGuildById(guildid);

    next();
});

router.use("/connections", connections);
router.use("/guilds", guilds);
router.use("/billing", billing);

//Or this 
router.get("/", quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    return res.status(200).json(globalUtils.sanitizeObject(req.account, ['settings', 'token', 'password', 'relationships', 'disabled_until', 'disabled_reason']));
  }
  catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch("/", rateLimitMiddleware(global.config.ratelimit_config.updateMe.maxPerTimeFrame, global.config.ratelimit_config.updateMe.timeFrame), Watchdog.middleware(global.config.ratelimit_config.updateMe.maxPerTimeFrame, global.config.ratelimit_config.updateMe.timeFrame, 0.5), async (req, res) => {
  try {
    let account = req.account;
    let originalAcc = account;

    if (account.bot) {
      if (req.body.username) {
        account.username = req.body.username;
      }

      if (account.username.length < global.config.limits['username'].min || account.username.length >= global.config.limits['username'].max) {
          return res.status(400).json({
            code: 400,
            username: `Must be between ${global.config.limits['username'].min} and ${global.config.limits['username'].max} characters.`
          });
      }

      let goodUsername = globalUtils.checkUsername(account.username);

      if (goodUsername.code !== 200) {
          return res.status(goodUsername.code).json(goodUsername);
      }

      if (req.body.avatar === "") {
        account.avatar = null;
      }

      if (req.body.avatar) {
        account.avatar = req.body.avatar;
      }

      account = await global.database.updateBotUser(account);

      if (!account) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      return res.status(200).json(account);
    }

    // New accounts via invite (unclaimed account) have null email and null password.
    // By genius Discord engineering if they claim an account it does not use new_password it uses password.

    let update = {
      avatar: null,
      email: null,
      new_password: null,
      new_email: null,
      password: null,
      username: account.username,
      discriminator: account.discriminator
    };

    if (req.body.avatar) {
        update.avatar = req.body.avatar;
    }

    if (account.email) {
      if (req.body.email) {
        update.email = req.body.email;
      }
  
      if (update.email && update.email != account.email) {
        update.new_email = update.email;
        update.email = account.email;
      }
    } else {
      if (req.body.email) {
        update.new_email = req.body.email;
      }
    }

    if (account.password) {
      if (req.body.new_password) {
        update.new_password = req.body.new_password;
      }
  
      if (req.body.password) {
         update.password = req.body.password;
      }
    } else {
      if (req.body.password) {
        update.new_password = req.body.password;
      }
    }

    if (req.body.username) {
      update.username = req.body.username;
    }

    if (req.body.discriminator) {
      update.discriminator = req.body.discriminator;
    }

    if (update.email == account.email && update.new_password == null && update.password == null && update.username == account.username && update.discriminator == account.discriminator) {
       //avatar change
       
       let tryUpdate = await global.database.updateAccount(account, update.avatar, account.username, account.discriminator, null, null);

       if (tryUpdate !== 3 && tryUpdate !== 2) {
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
       }

       let retAccount = await global.database.getAccountByEmail(account.email);

       if (!retAccount) {
          return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
       }

       await global.dispatcher.dispatchEventTo(retAccount.id, "USER_UPDATE", {
         avatar: retAccount.avatar,
         discriminator: retAccount.discriminator,
         email: retAccount.email,
         flags: retAccount.flags,
         id: retAccount.id,
         token: retAccount.token,
         username: retAccount.username,
         verified: retAccount.verified,
         mfa_enabled: retAccount.mfa_enabled,
         claimed: true
       });

       await global.dispatcher.dispatchGuildMemberUpdateToAllTheirGuilds(retAccount.id, retAccount);

       return res.status(200).json({
          avatar: retAccount.avatar,
          discriminator: retAccount.discriminator,
          email: retAccount.email,
          flags: retAccount.flags,
          id: retAccount.id,
          token: retAccount.token,
          username: retAccount.username,
          verified: retAccount.verified,
          mfa_enabled: retAccount.mfa_enabled,
          claimed: true
       });
    }

    if (account.password && update.password == null) {
      return res.status(400).json({
        code: 400,
        password: "This field is required"
      });
    }

    if (account.email && update.email == null) {
      return res.status(400).json({
        code: 400,
        email: "This field is required"
      });
    }

    if (update.username == null) {
      return res.status(400).json({
        code: 400,
        username: "This field is required"
      });
    }

    let discriminator = update.discriminator;
    
    if (isNaN(parseInt(discriminator)) || parseInt(discriminator) < 1 || parseInt(discriminator) > 9999 || discriminator.length !== 4) {
      return res.status(400).json({
        code: 400,
        username: "A valid discriminator is required."
      });
    }

    if (update.email && (update.email.length < 2 || update.email.length > 32)) {
      return res.status(400).json({
        code: 400,
        email: "Must be between 2 and 32 characters"
      });
    }

    if (update.new_email && (update.new_email.length < 2 || update.new_email.length > 32)) {
      return res.status(400).json({
        code: 400,
        email: "Must be between 2 and 32 characters"
      });
    }

    if (update.new_password && update.new_password.length > 64) {
      return res.status(400).json({
        code: 400,
        password: "Must be under 64 characters"
      });
    }

    let goodUsername = globalUtils.checkUsername(update.username);

    if (goodUsername.code !== 200) {
        return res.status(goodUsername.code).json(goodUsername);
    }

    if (update.password) {
      const correctPassword = await global.database.doesThisMatchPassword(update.password, account.password);

      if (!correctPassword) {
        return res.status(400).json({
          code: 400,
          password: "Incorrect password"
        })
      }
    }

    const attemptToUpdate = await global.database.updateAccount(account, update.avatar, update.username, update.discriminator, update.password, update.new_password, update.new_email);

    if (attemptToUpdate !== 3) {
      if (attemptToUpdate === -1) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
      }

      if (attemptToUpdate === 2) {
        return res.status(400).json({
          code: 400,
          password: "Incorrect password"
        }); //how?
      }

      if (attemptToUpdate === 0) {
        return res.status(400).json({
          code: 400,
          username: "Username#Tag combo already taken."
        }); //need to figure this one out - its a legacy response iirc
      }

      if (attemptToUpdate === 1) {
        return res.status(400).json(errors.response_400.TOO_MANY_USERS);
      }
    }

    account = await global.database.getAccountByUserId(account.id);

    if (!account) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    account = globalUtils.sanitizeObject(account, ['settings', 'created_at', 'password', 'relationships', 'disabled_until', 'disabled_reason']);

    if (originalAcc.email != account.email) {
       account.verified = false;

       await global.database.unverifyEmail(account.id);
    } //unverify them as they need to uh verify with their new email thingimajig

    await global.dispatcher.dispatchEventTo(account.id, "USER_UPDATE", {
      avatar: account.avatar,
      discriminator: account.discriminator,
      email: account.email,
      flags: account.flags,
      id: account.id,
      token: account.token,
      username: account.username,
      verified: account.verified,
      mfa_enabled: account.mfa_enabled,
      claimed: true
    });

    return res.status(200).json({
      avatar: account.avatar,
      discriminator: account.discriminator,
      email: account.email,
      flags: account.flags,
      id: account.id,
      token: account.token,
      username: account.username,
      verified: account.verified,
      mfa_enabled: account.mfa_enabled,
      claimed: true
    });
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
}); //someone PLEASE clean this up SOMEHOW

//Or this
router.get("/settings", quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    return res.status(200).json(req.account.settings);
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
})

router.patch("/settings", async (req, res) => {
  try {
    let account = req.account;
    let new_settings = account.settings;

    if (new_settings == null) {
      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    for (let key in req.body) {
      new_settings[key] = req.body[key];
    }

    const attempt = await global.database.updateSettings(account.id, new_settings);

    if (attempt) {
      const settings = new_settings;

      await global.dispatcher.dispatchEventTo(account.id, "USER_SETTINGS_UPDATE", settings);

      if (req.body.status) {
        const userSessions = global.userSessions.get(account.id);

        if (userSessions && userSessions.size > 0) {
          for (let session of userSessions) {
            session.presence.status = req.body.status.toLowerCase();
          }

          await userSessions[0].dispatchPresenceUpdate(userSessions[0].presence.status);
        }

        return res.status(204).send();
      } else {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
      }
    }
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
  }
});

router.get(/\/settings-proto\/.*/, async (req, res) => {
  try {
    let account = req.account;

    if (!account) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    return res.status(200).json({
      "settings": {
          "versions": {
              "dataVersion": 0
          },
          "favoriteGifs": {},
          "favoriteStickers": {},
          "stickerFrecency": {},
          "favoriteEmojis": {},
          "emojiFrecency": {
              "emojis": {}
          },
          "guildAndChannelFrecency": {},
          "emojiReactionFrecency": {}
      }
    });
  } catch (error) {
    logText(error, "error");

    return res.status(500).json({
      code: 500,
      message: "Internal Server Error"
    });
  }
})

router.patch(/\/settings-proto\/.*/, async (req, res) => {
  try {
    let account = req.account;

    if (!account) {
      return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    return res.status(403).json({
      code: 403,
      message: "This is a v9 endpoint, we will not implement the full set of v9. Do not make an issue about this."
    });
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
  }
});

router.put("/notes/:userid", async (req, res) => {
  //updateNoteForUserId
  try {
    let account = req.account;
    let user = req.user;

    if (!user) {
      return res.status(404).json({
        code: 404,
        message: "Unknown User"
      });
    }

    let new_notes = null;

    if (req.body.note && req.body.note.length > 1) {
      new_notes = req.body.note;
    }

    if (new_notes && new_notes.length > 250) {
      return res.status(400).json({
        code: 400,
        message: "User notes must be between 1 and 250 characters."
      });
    }

    let tryUpdate = await global.database.updateNoteForUserId(account.id, user.id, new_notes);

    if (!tryUpdate) {
      return res.status(500).json({
        code: 500,
        message: "Internal Server Error"
      })
    }

    await global.dispatcher.dispatchEventTo(account.id, "USER_NOTE_UPDATE", {
      id: user.id,
      note: new_notes
    });

    return res.status(204).send();
  } catch (error) {
    logText(error, "error");

    return res.status(500).json({
      code: 500,
      message: "Internal Server Error"
    })
  }
}); //too little for its own file

//Leaving guilds in late 2016

router.get("/mentions", quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    let account = req.account;
    let limit = req.query.limit ?? 25;
    let guild_id = req.query.guild_id ?? null;
    let include_roles = req.query.roles == "true" ?? false;
    let include_everyone_mentions = req.query.everyone == "true" ?? true;
    let before = req.query.before ?? null;

    if (!guild_id) {
      return res.status(200).json([]); //wtf why does this crash?
    }

    let recentMentions = await global.database.getRecentMentions(account.id, before, limit, include_roles, include_everyone_mentions, guild_id);

    return res.status(200).json(recentMentions);
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
  }
})

router.get("/activities", (req, res) => {
    return res.status(200).json([]);
});

router.get("/applications/:applicationid/entitlements", (req, res) => {
  return res.status(200).json([]);
})

router.get("/activities/statistics/applications", (req, res) => {
    return res.status(200).json([]);
});

router.get("/library", (req, res) => {
    return res.status(200).json([{
       id: "1279311572212178955",
       name: "Jason Citron Simulator 2024"
    }]);
});

router.get("/feed", (req, res) => {
    return res.status(200).json([]);
});

router.get("/feed/settings", (req, res) => {
    return res.status(200).json([]);
});

router.get("/entitlements/gifts", (req, res) => {
    return res.status(200).json([]);
});

router.get("/affinities/users", (req, res) => {
    return res.status(200).json({
        user_affinities: [],
        inverse_user_affinities: []
    });
});

router.get("/affinities/guilds", (req, res) => {
    return res.status(200).json({
        guild_affinities: [],
    });
});

router.post("/mfa/totp/enable", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 1), async (req, res) => {
  try {
    let code = req.body.code;
    let secret = req.body.secret;

    if (!code || !secret) {
       return res.status(400).json({
         code: 400,
         message: "Code and secret is required to enable TOTP"
       }) //figure this one out too
    }

    let user_mfa = await global.database.getUserMfa(req.account.id);

    if (user_mfa.mfa_enabled) {
       return res.status(400).json(errors.response_400.TWOFA_ALREADY_ENABLED)
    }

    let valid = await global.database.validateTotpCode(req.account.id, code, secret); //I KNOW I KNOW

    if (!valid) {
      return res.status(400).json({
         code: 400,
         message: "Invalid TOTP code"
       }); //to-do find the actual error msgs
    }

    await global.database.updateUserMfa(req.account.id, 1, secret);

    let returnedObj = globalUtils.sanitizeObject(req.account,
      ['settings', 'token', 'password', 'disabled_until', 'disabled_reason', 'relationships', 'created_at']
    );

    returnedObj.mfa_enabled = true;

    await global.dispatcher.dispatchEventTo(req.account.id, "USER_UPDATE", returnedObj);

    return res.status(200).json({
      token: req.headers['authorization'],
      backup_codes: [{
        code: "not-working-rn",
        consumed: false
      }]
    }) 
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
  }
});

router.post("/mfa/totp/disable", rateLimitMiddleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame), Watchdog.middleware(global.config.ratelimit_config.registration.maxPerTimeFrame, global.config.ratelimit_config.registration.timeFrame, 1), async (req, res) => {
  try {
    let code = req.body.code;

    if (!code) {
       return res.status(400).json({
         code: 400,
         message: "Code is required to disable TOTP"
       })
    }

    let user_mfa = await global.database.getUserMfa(req.account.id);

    if (!user_mfa.mfa_enabled) {
       return res.status(400).json(errors.response_400.TWOFA_NOT_ENABLED)
    }

    let valid = await global.database.validateTotpCode(req.account.id, code); //I KNOW I KNOW

    if (!valid) {
      return res.status(400).json({
         code: 400,
         message: "Invalid TOTP code"
       }); //to-do find the actual error msgs
    }

    await global.database.updateUserMfa(req.account.id, 0, null);

    let returnedObj = globalUtils.sanitizeObject(req.account,
      ['settings', 'token', 'password', 'disabled_until', 'disabled_reason', 'relationships', 'created_at']
    );

    returnedObj.mfa_enabled = false;

    await global.dispatcher.dispatchEventTo(req.account.id, "USER_UPDATE", returnedObj);

    return res.status(200).json(returnedObj);
  } catch (error) {
    logText(error, "error");

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR)
  }
});

module.exports = router;