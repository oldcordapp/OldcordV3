import { Router } from 'express';
import type { Response } from 'express';

import { logText } from '../../helpers/logger.ts';
const router = Router({ mergeParams: true });
import errors from '../../helpers/errors.ts';
import { prisma } from '../../prisma.ts';
import { generate } from '../../helpers/snowflake.ts';
import { generateString, generateToken } from '../../helpers/globalutils.ts';
import { genSalt, hash } from 'bcrypt';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import md5 from '../../helpers/md5.ts';

router.param('applicationid', async (req: any, _res: Response, next, applicationid: string) => {
  req.application = await prisma.application.findUnique({
    where: {
      id: applicationid
    },
    include: {
      bot: true
    }
  });

  if (req.application) {
    const bot = req.application.bot;

    if (bot) {
      const is_public = bot.public;
      const requires_code_grant = bot.require_code_grant;

      delete bot.public;
      delete bot.require_code_grant;
      delete bot.bot; //it already knows dummy

      req.application.bot = bot;
      req.application.bot_public = is_public;
      req.application.bot_require_code_grant = requires_code_grant;
    }
  }

  next();
});

router.get('/', async (req: any, res: Response) => {
  try {
    const account = req.account;

    if (!account) {
      return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    const applications = await prisma.application.findMany({
      where: {
        owner_id: req.account.id
      },
      include: {
        bot: true
      }
    });

    for (var application of applications as any) {
      const bot: any = application.bot;

      if (!bot) continue;

      const is_public = bot.public;
      const requires_code_grant = bot.requires_code_grant;

      delete bot.public;
      delete bot.require_code_grant;
      delete bot.bot;

      application.bot = bot;
      application.bot_public = is_public;
      application.bot_require_code_grant = requires_code_grant;
    }

    return res.status(200).json(applications);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/', async (req: any, res: Response) => {
  try {
    const name = req.body.name;

    if (!name) {
      return res.status(400).json({
        code: 400,
        name: 'This field is required',
      }); // move this to its own response
    }

    if (name.length < 2 || name.length > 30) {
      return res.status(400).json({
        code: 400,
        name: 'Must be between 2 and 30 characters.',
      }); //move to its own response
    }

    const id = generate();
    const secret = generateString(20);
    const application = await prisma.application.create({
      data: {
        id: id,
        owner_id: req.account.id,
        name: name,
        icon: null,
        secret: secret,
        description: ''
      }
    });

    return res.status(200).json(application);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.get('/:applicationid', async (req: any, res: Response) => {
  try {
    const account = req.account;

    if (!req.application) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    if (req.application.owner.id != account.id) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION); //Figure out the proper response here
    }

    return res.status(200).json(req.application);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.patch('/:applicationid', async (req: any, res: Response) => {
  try {
    const account = req.account;
    const application = req.application;

    if (!application || application.owner.id !== account.id) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    if (req.body.name) {
      application.name = req.body.name;
    }

    if (req.body.icon === '') {
      application.icon = null;
    }

    if (req.body.icon) {
      application.icon = req.body.icon;
    }

    if (req.body.description != undefined) {
      application.description = req.body.description;
    }

    let send_update_bot = false;

    if (req.body.bot_public != undefined && application.bot) {
      application.bot_public = req.body.bot_public;
      application.bot.public = req.body.bot_public;

      send_update_bot = true;
    }

    if (req.body.bot_require_code_grant != undefined && application.bot) {
      application.bot_require_code_grant = req.body.bot_require_code_grant;
      application.bot.require_code_grant = req.body.bot_require_code_grant;

      send_update_bot = true;
    }

    if (application.name.length < 2 || application.name.length > 30) {
      return res.status(400).json({
        code: 400,
        name: 'Must be between 2 and 30 characters.',
      });
    }

    if (application.description.length > 400) {
      return res.status(400).json({
        code: 400,
        description: 'Must be under 400 characters.',
      }); //to-do
    }

    try {
      let send_icon: any = null;

      if (application.icon != null) {
        if (application.icon.includes('data:image')) {
          var extension = application.icon.split('/')[1].split(';')[0];
          var imgData = application.icon.replace(`data:image/${extension};base64,`, '');
          var file_name = generateString(30);
          var hash = md5(file_name);

          if (extension == 'jpeg') {
            extension = 'jpg';
          }

          send_icon = hash.toString();

          if (!existsSync(`www_dynamic/applications_icons`)) {
            mkdirSync(`www_dynamic/applications_icons`, { recursive: true });
          }

          if (!existsSync(`www_dynamic/applications_icons/${application.id}`)) {
            mkdirSync(`www_dynamic/applications_icons/${application.id}`, { recursive: true });

            writeFileSync(
              `www_dynamic/applications_icons/${application.id}/${hash}.${extension}`,
              imgData,
              'base64',
            );
          } else {
            writeFileSync(
              `www_dynamic/applications_icons/${application.id}/${hash}.${extension}`,
              imgData,
              'base64',
            );
          }
        } else {
          send_icon = application.icon;
        }
      }

      await prisma.application.update({
        where: {
          id: application.id
        },
        data: {
          icon: send_icon,
          name: application.name,
          description: application.description
        }
      })

      application.icon = send_icon;

      let send_icon2: any = null;

      if (application.bot.avatar != null) {
        if (application.bot.avatar.includes('data:image')) {
          var extension = application.bot.avatar.split('/')[1].split(';')[0];
          var imgData = application.bot.avatar.replace(`data:image/${extension};base64,`, '');
          var file_name = generateString(30);
          var hash = md5(file_name);

          if (extension == 'jpeg') {
            extension = 'jpg';
          }

          send_icon2 = hash.toString();

          if (!existsSync(`www_dynamic/avatars`)) {
            mkdirSync(`www_dynamic/avatars`, { recursive: true });
          }

          if (!existsSync(`www_dynamic/avatars/${application.bot.id}`)) {
            mkdirSync(`www_dynamic/avatars/${application.bot.id}`, { recursive: true });

            writeFileSync(`www_dynamic/avatars/${application.bot.id}/${hash}.${extension}`, imgData, 'base64');
          } else {
            writeFileSync(`www_dynamic/avatars/${application.bot.id}/${hash}.${extension}`, imgData, 'base64');
          }
        } else {
          send_icon2 = application.bot.avatar;
        }
      }

      if (send_update_bot) {
        await prisma.bot.update({
          where: {
            id: application.bot.id
          },
          data: {
            avatar: send_icon2,
            username: application.bot.username,
            public: application.bot.public,
            require_code_grant: application.bot.require_code_grant
          }
        })

        application.bot.avatar = send_icon2;

        delete application.bot.public;
        delete application.bot.require_code_grant;
      }
    }
    catch (error) {
      logText(error, "error");

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    req.application = application;

    return res.status(200).json(application);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

//I don't know if this is even necessary, yolo
router.delete('/:applicationid', async (req: any, res: Response) => {
  try {
    const account = req.account;
    const application = req.application;

    if (!application || application.owner.id != account.id) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    await prisma.$transaction([
      prisma.bot.delete({ where: { id: application.id } }),
      prisma.application.delete({ where: { id: application.id } })
    ]);

    return res.status(204).send(); //going to assume this is just a 204 for now
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/:applicationid/bot', async (req: any, res: Response) => {
  try {
    const account = req.account;
    const application = req.application;

    if (!application || application.owner.id != account.id) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    if (application.bot) {
      return res.status(400).json({
        code: 400,
        message: 'This application has already been turned into a bot',
      }); //figure this one out aswell
    }

    let tryCreateBot: any = null;

    try {
      const salt = await genSalt(10);
      const pwHash = await hash(generateString(30), salt);

      let discriminator = Math.round(Math.random() * 9999);

      while (discriminator < 1000) {
        discriminator = Math.round(Math.random() * 9999);
      }

      const token = generateToken(application.id, pwHash);

      tryCreateBot = await prisma.bot.create({
        data: {
          id: application.id,
          application_id: application.id,
          username: application.name,
          discriminator: discriminator.toString(),
          avatar: null,
          token: token
        }
      });
    }
    catch (error) {
      logText(error, "error");

      return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    return res.status(200).json(tryCreateBot);
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

router.post('/:applicationid/delete', async (req: any, res: Response) => {
  try {
    const account = req.account;
    const application = req.application;

    if (!application || application.owner.id != account.id) {
      return res.status(404).json(errors.response_404.UNKNOWN_APPLICATION);
    }

    await prisma.$transaction([
      prisma.bot.delete({ where: { id: application.id } }),
      prisma.application.delete({ where: { id: application.id } })
    ]);

    return res.status(204).send(); //going to assume this is just a 204 for now
  } catch (error) {
    logText(error, 'error');

    return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
  }
});

export default router;
