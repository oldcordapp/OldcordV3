import { Router } from 'express';

import { logText } from '../helpers/logger.ts';
const router = Router({ mergeParams: true });
import { response_500 } from '../helpers/errors.ts';
import { rateLimitMiddleware } from '../helpers/middlewares.ts';
import { middleware } from '../helpers/watchdog.ts';
import type { Response } from "express";
import { prisma } from '../prisma.ts';
import { generate } from '../helpers/snowflake.ts';

router.post(
  '/',
  rateLimitMiddleware(
    global.config.ratelimit_config.reports.maxPerTimeFrame,
    global.config.ratelimit_config.reports.timeFrame,
  ),
  middleware(
    global.config.ratelimit_config.reports.maxPerTimeFrame,
    global.config.ratelimit_config.reports.timeFrame,
    0.5,
  ),
  async (req: any, res: Response) => {
    try {
      const valid_problems = [
        'Child Sexual Abuse Material (CSAM)',
        'Threat of Self-Harm or Suicide',
        'Terrorism or Violent Extremism',
        'Direct Threats of Violence/Harm',
        'Targeted Harassment or Bullying',
        'Hate Speech or Discrimination',
        'Non-Consensual Intimate Imagery (NCII)',
        'Spam, Scams, or Malware',
        'Copyright or Trademark Infringement',
        'Pornography or Sexually Explicit Content (where prohibited)',
        'Impersonation or Identity Theft',
        'Revealing Private Information (Doxxing)',
        'Other',
      ];

      const subject = req.body.subject;
      const description = req.body.description;
      const email_address = req.body.email_address;
      const problem = req.body.problem;

      if (!subject || subject === '' || subject.length < 1) {
        return res.status(400).json({
          code: 400,
          subject: 'This field is required.',
        });
      }

      if (subject.length > 1250) {
        return res.status(400).json({
          code: 400,
          subject: 'Must be between 1 and 1250 characters.',
        });
      }

      if (!description || description === '' || description.length < 1) {
        return res.status(400).json({
          code: 400,
          subject: 'This field is required.',
        });
      }

      if (description.length > 1250) {
        return res.status(400).json({
          code: 400,
          description: 'Must be between 1 and 1250 characters.',
        });
      }

      if (!problem || !valid_problems.includes(problem)) {
        return res.status(400).json({
          code: 400,
          problem: 'This field is required.',
        });
      }

      await prisma.instanceReport.create({
        data: {
          description: description,
          subject: subject,
          problem: problem,
          email_address: email_address ?? null,
          id: generate(),
          action: 'PENDING'
        }
      });

      return res.status(204).send();
    } catch (error) {
      logText(error, 'error');

      return res.status(500).json(response_500.INTERNAL_SERVER_ERROR);
    }
  },
);

export default router;
