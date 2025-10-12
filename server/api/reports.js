const express = require('express');
const { logText } = require('../helpers/logger');
const router = express.Router({ mergeParams: true });
const { rateLimitMiddleware } = require('../helpers/middlewares');

router.post("/", rateLimitMiddleware(global.config.ratelimit_config.reports.maxPerTimeFrame, global.config.ratelimit_config.reports.timeFrame), async (req, res) => {
    try {
        let valid_problems = [
            "Child Sexual Abuse Material (CSAM)",
            "Threat of Self-Harm or Suicide",
            "Terrorism or Violent Extremism",
            "Direct Threats of Violence/Harm",
            "Targeted Harassment or Bullying",
            "Hate Speech or Discrimination",
            "Non-Consensual Intimate Imagery (NCII)",
            "Spam, Scams, or Malware",
            "Copyright or Trademark Infringement",
            "Pornography or Sexually Explicit Content (where prohibited)",
            "Impersonation or Identity Theft",
            "Revealing Private Information (Doxxing)",
            "Other"
        ];

        let subject = req.body.subject;
        let description = req.body.description;
        let email_address = req.body.email_address;
        let problem = req.body.problem;

        if (!subject || subject === "" || subject.length < 1) {
            return res.status(400).json({
                code: 400,
                subject: "This field is required."
            });
        }

        if (subject.length > 1250) {
            return res.status(400).json({
                code: 400,
                subject: "Must be between 1 and 1250 characters."
            })
        }

        if (!description || description === "" || description.length < 1) {
            return res.status(400).json({
                code: 400,
                subject: "This field is required."
            });
        }

        if (description.length > 1250) {
            return res.status(400).json({
                code: 400,
                description: "Must be between 1 and 1250 characters."
            })
        }

        if (!problem || !valid_problems.includes(problem)) {
            return res.status(400).json({
                code: 400,
                problem: "This field is required."
            });
        }

        await global.database.submitInstanceReport(description, subject, problem, email_address ?? null);

        return res.status(204).send();
    } catch (error) {
        logText(error, "error");
    
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
    }
});

module.exports = router;