import { Router } from 'express';

import dispatcher from '../../helpers/dispatcher.js';
import errors from '../../helpers/errors.js';
import globalUtils from '../../helpers/globalutils.js';
import { logText } from '../../helpers/logger.js';
import quickcache from '../../helpers/quickcache.js';

const router = Router();

router.param('userid', async (req, _, next, userid) => {
  req.user = await global.database.getAccountByUserId(userid);

  next();
});

//Never share this because it's unique to the requester lol

router.get('/', quickcache.cacheFor(60 * 5), async (req, res) => {
  try {
    let account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_USE_THIS_ENDPOINT); //bots.. ermm
    }

    let relationships = account.relationships;

    return res.status(200).json(relationships);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.delete('/:userid', async (req, res) => {
  try {
    let account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_HAVE_FRIENDS); //bots cannot add users
    }

    let user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_HAVE_FRIENDS); //bots cannot add users
    }

    let relationship = account.relationships.find((item) => item.id === req.user.id);

    if (!relationship) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER); //relationship was not found, is this the correct response?
    }

    await dispatcher.dispatchEventTo(account.id, 'RELATIONSHIP_REMOVE', {
      id: relationship.id,
    });

    if (relationship.type != 2) {
      //the only case where a user other than the requester receives an event
      await dispatcher.dispatchEventTo(relationship.id, 'RELATIONSHIP_REMOVE', {
        id: account.id,
      });
    }

    relationship.type = 0; //this happens in all cases

    await global.database.modifyRelationship(account.id, relationship);

    return res.status(204).send();
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.put('/:userid', async (req, res) => {
  try {
    let account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_HAVE_FRIENDS);
    }

    let user = req.user;

    if (!user) {
      return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (user.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_HAVE_FRIENDS);
    }

    let body = req.body;
    var type = 'SEND_FR';
    let relationship = account.relationships.find((item) => item.id === user.id) ?? { type: 0 };

    if (relationship.type == 3) {
      type = 'ACCEPT_FR';
    } else if (body.type == 2) {
      type = 'BLOCK';
    }

    let targetRelationship = user.relationships.find((item) => item.id === account.id) ?? {
      type: 0,
    };

    //The following can be expanded to:
    //if (relationship.type === 2 || relationship.type === 1) {return 403}
    //if (targetRelationship.type === 2) {return 403}
    //if (!user.settings.friend_source_flags) {return 403}
    //if (!user.settings.friend_source_flags.all && !user.settings.friend_source_flags.mutual_friends && !user.settings.friend_source_flags.mutual_guilds) {return 403}
    //
    //It is compressed to not have repetetive lines. If you wish, revert this.
    if (type === 'SEND_FR') {
      if (
        relationship.type === 2 ||
        relationship.type === 1 ||
        targetRelationship.type === 2 ||
        !user.settings.friend_source_flags ||
        (!user.settings.friend_source_flags.all &&
          !user.settings.friend_source_flags.mutual_friends &&
          !user.settings.friend_source_flags.mutual_guilds)
      ) {
        return res.status(403).json({
          code: 403,
          message: 'Failed to send friend request',
        });
      } //figure these responses out

      if (!user.settings.friend_source_flags.all) {
        //to-do: handle mutual_guilds, mutual_friends case

        if (user.settings.friend_source_flags.mutual_guilds) {
          let ourGuilds = await global.database.getUsersGuilds(account.id);

          if (!ourGuilds) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }

          let compareWith = await global.database.getUsersGuilds(user.id);

          compareWith = compareWith.map((i) => i.id);

          if (compareWith.length === 0) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }

          let sharedGuilds = [];

          for (var guild of ourGuilds) {
            if (compareWith.includes(guild.id)) {
              sharedGuilds.push(guild.id);
            }
          }

          if (sharedGuilds.length === 0) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }
        }

        if (user.settings.friend_source_flags.mutual_friends) {
          let sharedFriends = [];

          for (var friend of account.relationships.find((item) => item.type === 1)) {
            if (user.relationships.map((i) => i.id).includes(friend.id)) {
              sharedFriends.push(friend);
            }
          }

          if (sharedFriends.length === 0) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }
        }
      }

      await global.database.addRelationship(account.id, 3, user.id);

      await dispatcher.dispatchEventTo(account.id, 'RELATIONSHIP_ADD', {
        id: user.id,
        type: 4,
        user: globalUtils.miniUserObject(user),
      });

      await dispatcher.dispatchEventTo(user.id, 'RELATIONSHIP_ADD', {
        id: account.id,
        type: 3,
        user: globalUtils.miniUserObject(account),
      });

      return res.status(204).send();
    } else if (type === 'ACCEPT_FR') {
      if (relationship.type === 3) {
        relationship.type = 1;

        await global.database.modifyRelationship(account.id, relationship);

        await dispatcher.dispatchEventTo(account.id, 'RELATIONSHIP_ADD', {
          id: user.id,
          type: 1,
          user: globalUtils.miniUserObject(user),
        });

        await dispatcher.dispatchEventTo(user.id, 'RELATIONSHIP_ADD', {
          id: account.id,
          type: 1,
          user: globalUtils.miniUserObject(account),
        });

        return res.status(204).send();
      } else {
        return res.status(400).json({
          code: 400,
          message: 'No pending friend request',
        });
      }
    } else if (type === 'BLOCK') {
      if (relationship.type === 1) {
        //ex-friend
        relationship.type = 0; //cannot set this to 2 in the case that the user blocking is not the user that initiated the current relationship

        await global.database.modifyRelationship(account.id, relationship);

        await dispatcher.dispatchEventTo(user.id, 'RELATIONSHIP_REMOVE', {
          id: account.id,
        });
      }

      await global.database.addRelationship(account.id, 2, user.id);

      await dispatcher.dispatchEventTo(account.id, 'RELATIONSHIP_ADD', {
        id: user.id,
        type: 2,
        user: globalUtils.miniUserObject(user),
      });

      return res.status(204).send();
    }
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/', async (req, res) => {
  try {
    let account = req.account;

    if (account.bot) {
      return res.status(403).json(errors.response_403.BOTS_CANNOT_HAVE_FRIENDS);
    }

    let email = null;

    if (req.body.email) {
      email = req.body.email;
    }

    let username = null;
    let discriminator = null;

    if (req.body.username) {
      username = req.body.username;
    }

    if (req.body.discriminator) {
      discriminator = req.body.discriminator.toString().padStart(4, '0');
    }

    if (!email && (!username || !discriminator)) {
      //catches case where username but not discrim (or vice versa) is provided (removes need for the return 400 at the end of this try statement)
      return res.status(400).json({
        code: 400,
        message: 'An email or username and discriminator combo is required.',
      });
    }

    if (email) {
      let user = await global.database.getAccountByEmail(email);

      if (!user) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
      }

      if (
        user.settings.allow_email_friend_request != undefined &&
        !user.settings.allow_email_friend_request
      ) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
      } //be very vague to protect the users privacy

      let relationship = account.relationships.find((item) => item.id === user.id) ?? { type: 0 };

      let targetRelationship = user.relationships.find((item) => item.id === account.id) ?? {
        type: 0,
      };

      if (relationship.type === 2 || relaionship.type === 1 || targetRelationship.type === 2) {
        return res.status(403).json({
          code: 403,
          message: 'Failed to send friend request',
        });
      }

      await global.database.addRelationship(account.id, 3, user.id);

      await dispatcher.dispatchEventTo(account.id, 'RELATIONSHIP_ADD', {
        id: user.id,
        type: 4,
        user: globalUtils.miniUserObject(user),
      });

      await dispatcher.dispatchEventTo(user.id, 'RELATIONSHIP_ADD', {
        id: account.id,
        type: 3,
        user: globalUtils.miniUserObject(account),
      });

      return res.status(204).send();
    }

    if (username && discriminator) {
      let user = await global.database.getAccountByUsernameTag(username, discriminator);

      if (!user) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
      }

      if (user.bot) {
        return res.status(403).json(errors.response_403.BOTS_CANNOT_HAVE_FRIENDS);
      }

      let relationship = account.relationships.find((item) => item.id === user.id) ?? { type: 0 };

      let targetRelationship = user.relationships.find((item) => item.id === account.id) ?? {
        type: 0,
      };

      if (relationship.type === 2 || relationship.type === 1 || targetRelationship.type === 2) {
        return res.status(403).json({
          code: 403,
          message: 'Failed to send friend request',
        });
      }

      if (!user.settings.friend_source_flags) {
        return res.status(403).json({
          code: 403,
          message: 'Failed to send friend request',
        });
      }

      if (
        !user.settings.friend_source_flags.all &&
        !user.settings.friend_source_flags.mutual_friends &&
        !user.settings.friend_source_flags.mutual_guilds
      ) {
        return res.status(403).json({
          code: 403,
          message: 'Failed to send friend request',
        });
      }

      if (!user.settings.friend_source_flags.all) {
        //to-do: handle mutual_guilds, mutual_friends case

        if (user.settings.friend_source_flags.mutual_guilds) {
          let ourGuilds = await global.database.getUsersGuilds(account.id);

          if (!ourGuilds) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }

          let compareWith = await global.database.getUsersGuilds(user.id);

          compareWith = compareWith.map((i) => i.id);

          if (compareWith.length === 0) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }

          let sharedGuilds = [];

          for (var guild of ourGuilds) {
            if (compareWith.includes(guild.id)) {
              sharedGuilds.push(guild.id);
            }
          }

          if (sharedGuilds.length === 0) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }
        }

        if (user.settings.friend_source_flags.mutual_friends) {
          let sharedFriends = [];

          for (var friend of account.relationships.find((item) => item.type === 1)) {
            if (user.relationships.map((i) => i.id).includes(friend.id)) {
              sharedFriends.push(friend);
            }
          }

          if (sharedFriends.length === 0) {
            return res.status(403).json({
              code: 403,
              message: 'Failed to send friend request',
            });
          }
        }
      }

      await global.database.addRelationship(account.id, 3, user.id);

      await dispatcher.dispatchEventTo(account.id, 'RELATIONSHIP_ADD', {
        id: user.id,
        type: 4,
        user: globalUtils.miniUserObject(user),
      });

      await dispatcher.dispatchEventTo(user.id, 'RELATIONSHIP_ADD', {
        id: account.id,
        type: 3,
        user: globalUtils.miniUserObject(account),
      });

      return res.status(204).send();
    }
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
