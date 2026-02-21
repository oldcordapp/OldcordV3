import { rateLimitMiddleware } from '@/helpers/middlewares.js';
import errors from '../helpers/consts/errors.js';
import { logText } from '../helpers/utils/logger.ts';
import type { Response } from 'express';
import { Router } from 'express';
import { middleware } from '../helpers/watchdog.ts';

const router = Router({ mergeParams: true });

const REPORT_REASONS = [
    {
        reason: 1,
        label: "Illegal Content",
        description: "Child pornography, solicitation of minors, terrorism, threats of school shootings or criminal activity."
    }, {
        reason: 2,
        label: "Harassment",
        description: "Threats, stalking, bullying, sharing of personal information, impersonation or raiding."
    }, {
        reason: 3,
        label: "Spam or Phishing Links",
        description: "Fake links, invites to a server via bot, malicious links or attachments."
    }, {
        reason: 4,
        label: "Self Harm",
        description: "Person is at risk of claimed intent of self-harm."
    }, {
        reason: 5,
        label: "NSFW Content",
        description: "Pornography or other adult content in a non-NSFW channel or unwanted DM."
    }
];

router.get('/', (_req: any, res: Response) => {
    return res.status(200).json(REPORT_REASONS);
});

router.post('/', rateLimitMiddleware(
    global.config.ratelimit_config.reports.maxPerTimeFrame,
    global.config.ratelimit_config.reports.timeFrame,
  ),
   middleware(
    global.config.ratelimit_config.reports.maxPerTimeFrame,
    global.config.ratelimit_config.reports.timeFrame,
    0.5,
  ), async (req: any, res: Response) => {
    try {
        const { channel_id, message_id, reason } = req.body;
        const report = REPORT_REASONS.find(x => x.reason === reason);

        if (!report) {
            return res.status(400).json({
                code: 400,
                message: "Invalid report reason"
            })
        };

        await global.database.submitInstanceReport(
            report.description,
            `Report in channel ID: ${channel_id} on msg ID: ${message_id} `,
            report.label,
            null,
        );

        return res.status(204).send();
    }
    catch (err) {
        logText(err, 'error');
        
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
});

export default router;