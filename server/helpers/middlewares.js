const rateLimit = require('express-rate-limit');
const { logText } = require('./logger');
const globalUtils = require('./globalutils');
const wayback = require('./wayback');
const fs = require('fs');
const errors = require('./errors');

const config = globalUtils.config;

const spacebarApis = ["/.well-known/spacebar", "/policies/instance/domains"];

let cached404s = {};

function corsMiddleware(req, res, next) {
    // Stolen from spacebar because of allowing fermi/flicker support
    res.set("Access-Control-Allow-Credentials", "true");
    res.set("Access-Control-Allow-Headers", req.header("Access-Control-Request-Headers") || "*");
    res.set("Access-Control-Allow-Methods", req.header("Access-Control-Request-Method") || "*");
    res.set("Access-Control-Allow-Origin", req.header("Origin") ?? "*");
    res.set("Access-Control-Max-Age", "5"); // dont make it too long so we can change it dynamically

    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
}

function apiVersionMiddleware(req, _, next) {
    const versionRegex = /^\/v(\d+)/;
    const match = req.path.match(versionRegex);

    if (match) {
        req.apiVersion = parseInt(match[1], 10);

        req.url = req.url.replace(versionRegex, '');
        if (req.url === '') {
            req.url = '/';
        }
    } else {
        req.apiVersion = 3;
    }

    next();
};

async function clientMiddleware(req, res, next) {
    try {
        if (spacebarApis.includes(req.path)) return next();

        if (req.url.includes("/selector") || req.url.includes("/launch") || req.url.includes("/webhooks") || req.url.includes("/instance")) return next();

        const reqHost = (req.headers.origin || req.headers.host || '').replace(/^(https?:\/\/)?/, '');

        const isInstanceLocal = global.full_url.includes('localhost') || global.full_url.includes('127.0.0.1');
        const isReqLocal = reqHost.includes('localhost') || reqHost.includes('127.0.0.1');

        const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge/i.test(req.headers['user-agent']);
        let isSameHost = false;

        if (global.full_url === reqHost) {
            isSameHost = true;
        } else if (isInstanceLocal && isReqLocal) {            
            const normalizedInstance = global.full_url.replace('localhost', '127.0.0.1');
            const normalizedReq = reqHost.replace('localhost', '127.0.0.1');

            isSameHost = normalizedInstance === normalizedReq;
        } else {
            isSameHost = false;
        }

        let cookies = req.cookies;

        if (!cookies || (!cookies['release_date'] && !isSameHost) || !isBrowser) {
            cookies['release_date'] = "thirdPartyOrMobile"
            res.cookie('release_date', "thirdPartyOrMobile")
        }

        if (!cookies['release_date'] && isSameHost && isBrowser && !config.require_release_date_cookie) {
            res.cookie('release_date', config.default_client_build || "october_5_2017", {
                maxAge: 100 * 365 * 24 * 60 * 60 * 1000
            });
        }

        if ((!cookies['default_client_build'] || cookies['default_client_build'] !== (config.default_client_build || "october_5_2017")) && isSameHost && isBrowser) {
            res.cookie('default_client_build', config.default_client_build || "october_5_2017", {
                maxAge: 100 * 365 * 24 * 60 * 60 * 1000
            });
        }

        cookies = req.cookies;

        if (!globalUtils.addClientCapabilities(cookies['release_date'], req)) {
            return res.redirect("/selector");
        }

        next();
    }
    catch(error) {
        logText(error, "error");
        
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }
};

function rateLimitMiddleware(max, windowMs, ignore_trusted = true) {
    const rL = rateLimit({
        windowMs: windowMs,
        max: max,
        handler: (req, res, next) => {
            if (!config.ratelimit_config.enabled) {
                return next();
            }

            if (ignore_trusted && req.account && config.trusted_users.includes(req.account.id)) {
                return next();
            }    

            const retryAfter = Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()));

            res.status(429).json({
                ...errors.response_429.RATE_LIMITED,
                retry_after: retryAfter,
                global: true
            });
        }
    });

    return function (req, res, next) {
        rL(req, res, (err) => {
            if (err) return next(err);
            next();
        });
    }
}

async function assetsMiddleware(req, res) {
    try {
        globalUtils.addClientCapabilities(req.cookies['release_date'], req);

        if (config.cache404s && cached404s[req.params.asset] == 1) {
            return res.status(404).send("File not found");
        }

        if (req.params.asset.includes(".map")) {
            cached404s[req.params.asset] = 1;

            return res.status(404).send("File not found");
        }

        const filePath = `./www_dynamic/assets/${req.params.asset}`;

        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }

        let doWayback = true;
        let isOldBucket = false;

        if (req.client_build_date.getFullYear() === 2018 && req.client_build_date.getMonth() >= 6 || req.client_build_date.getFullYear() >= 2019) {
            doWayback = false;
        } //check if older than june 2018 to request from cdn

        async function handleRequest(doWayback) {
            let timestamp = null;
            let snapshot_url = `https://cdn.oldcordapp.com/assets/${req.params.asset}`; //try download from oldcord cdn first

            if (doWayback) {
                let timestamps = await wayback.getTimestamps(`https://discordapp.com/assets/${req.params.asset}`);

                if (timestamps == null || timestamps.first_ts.includes("1999") || timestamps.first_ts.includes("2000")) {
                    timestamps = await wayback.getTimestamps(`https://d3dsisomax34re.cloudfront.net/assets/${req.params.asset}`);

                    if (timestamps == null || timestamps.first_ts.includes("1999") || timestamps.first_ts.includes("2000")) {
                        cached404s[req.params.asset] = 1;

                        return res.status(404).send("File not found");
                    }

                    isOldBucket = true;
                }

                timestamp = timestamps.first_ts;

                if (isOldBucket) {
                    snapshot_url = `https://web.archive.org/web/${timestamp}id_/https://d3dsisomax34re.cloudfront.net/assets/${req.params.asset}`;
                } else {
                    snapshot_url = `https://web.archive.org/web/${timestamp}id_/https://discordapp.com/assets/${req.params.asset}`;
                }
            }

            logText(`[LOG] Saving ${req.params.asset} from ${snapshot_url}...`, 'debug');

            let r = await fetch(snapshot_url);

            if (!r.ok) {
                cached404s[req.params.asset] = 1;

                return res.status(404).send("File not found");
            }

            if (r.status === 404 && !doWayback) {
                doWayback = true;

                return await handleRequest(doWayback);
            }

            if (r.status >= 400) {
                logText(`!! Error saving asset: ${snapshot_url} - reports ${r.status} !!`, 'debug');

                cached404s[req.params.asset] = 1;

                return res.status(404).send("File not found");
            }

            const arrayBuffer = await r.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (!fs.existsSync("./www_dynamic/assets")) {
                fs.mkdirSync("./www_dynamic/assets", { recursive: true });
            }

            fs.writeFileSync(filePath, buffer);

            logText(`[LOG] Saved ${req.params.asset} from ${snapshot_url} successfully.`, 'debug');

            res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") });
            res.end(buffer);
        }

        await handleRequest(doWayback);
    }
    catch(error) {
        logText(error, "error");
        
        return res.status(404).send("File not found");
    }
}

function staffAccessMiddleware(privilege_needed) {
    return async function (req, res, next) {
        try {
            let account = req.account;

            if (!account) {
                return res.status(401).json(errors.response_401.UNAUTHORIZED);
            }

            if (!req.is_staff) {
                return res.status(401).json(errors.response_401.UNAUTHORIZED);
            }

            if (req.staff_details.privilege < privilege_needed) {
                return res.status(401).json(errors.response_401.UNAUTHORIZED);
            }

            if (!account.mfa_enabled && global.config.mfa_required_for_admin) {
                if (req.method === "GET" && req.url.endsWith("/@me")) {
                    return next();
                } //Exclude from the admin info get request

                return res.status(401).json(errors.response_401.UNAUTHORIZED);
            }

            next();
        } catch(err) {
            logText(err, "error");

            return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
        }
    };
}

async function authMiddleware(req, res, next) {
    try {
        if ((req.url.includes("/webhooks/") || (req.url.includes("/invite/")) && req.method === "GET")) {
            return next();
        } //exclude webhooks and invites from this

        if (spacebarApis.includes(req.path)) {
            return next();
        } // exclude spacebar related apis

        if (req.url.match(/webhooks\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/) && req.method === "POST") {
            return next();
        } //bypass sending to webhooks

        let token = req.headers['authorization'];
        
        req.cannot_pass = false;
        
        if (!token) {
            return res.status(404).json(errors.response_404.NOT_FOUND); //discord's old api used to just return this if you tried it unauthenticated. so i guess, return that too?
        }

        let account = await global.database.getAccountByToken(token);
    
        if (!account) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);
        }

        if (account.disabled_until != null) {
            req.cannot_pass = true;
        }

        let staffDetails = await global.database.getStaffDetails(account.id);

        if (staffDetails != null) {
            req.is_staff = true;
            req.staff_details = staffDetails;
        }
      
        if (!account.bot) {
            let xSuperProperties = req.headers['X-Super-Properties'];
            let userAgent = req.headers['User-Agent'];
            
            try {
                let validSuperProps = globalUtils.validSuperPropertiesObject(xSuperProperties, req.originalUrl, req.baseUrl, userAgent);

                req.cannot_pass = xSuperProperties && userAgent && !validSuperProps;
            } catch { }
        }

        if (req.cannot_pass) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);
        }

        req.account = account;

        next();
    }
    catch(err) {
        logText(err, "error");

        return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }
}

function instanceMiddleware(flag_check) {
    return function (req, res, next) {
        let check = config.instance.flags.includes(flag_check);

        if (check) {
            if (flag_check === "VERIFIED_EMAIL_REQUIRED") {
                if (req.account && req.account.verified) {
                    return next();
                }

                return res.status(403).json(errors.response_403.ACCOUNT_VERIFICATION_REQUIRED); //figure this error out
            }

            return res.status(400).json({
                code: 400,
                message: globalUtils.flagToReason(flag_check)
            });
        }

        next();
    };
}

async function guildMiddleware(req, res, next) {
    if (!req.params.guildid) {
        return next();
    }

    let guild = req.guild;

    if (!guild) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    const sender = req.account;

    if (sender == null) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    if (req.is_staff) {
        return next();
    }

    let member = guild.members.find(y => y.id == sender.id);

    if (!member) {
        return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
    }

    next();
}

async function userMiddleware(req, res, next) {
    let account = req.account;

    if (!account) {
        return res.status(401).json(errors.response_401.UNAUTHORIZED);
    }

    let user = req.user;

    if (!user) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    if (globalUtils.areWeFriends(account, user)) {
        return next();
    }

    let guilds = await global.database.getUsersGuilds(user.id);

    if (guilds.length == 0) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
    } //investigate later

    let share = guilds.some(guild => guild.members != null && guild.members.length > 0 && guild.members.some(member => member.id === account.id));

    if (!share) {
        return res.status(404).json(errors.response_404.UNKNOWN_USER);
    }

    next();
}

async function channelMiddleware(req, res, next) {
    let channel = req.channel;

    if (!channel) {
        return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
    }

    if (!channel.guild_id) {
        return next();
    }

    if (!req.params.guildid) {
        req.params.guildid = channel.guild_id;
    }

    const sender = req.account;

    if (!sender) {
        return res.status(500).json(errors.response_500.INTERNAL_SERVER_ERROR);
    }

    if (!req.guild && channel.id.includes('12792182114301050')) return next();

    if (!req.guild) {
        req.guild = await global.database.getGuildById(req.params.guildid); //hate this also
    }

    if (req.is_staff) {
        return next();
    }

    let member = req.guild.members.find(y => y.id == sender.id);

    if (member == null) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    let gCheck = global.permissions.hasGuildPermissionTo(req.guild, member.id, "READ_MESSAGES", req.client_build);

    if (!gCheck) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    let pCheck = global.permissions.hasChannelPermissionTo(req.channel, req.guild, member.id, "READ_MESSAGES");

    if (!pCheck) {
        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
    }

    next();
}

function guildPermissionsMiddleware(permission) {
    return async function (req, res, next) {
        const sender = req.account;

        if (sender == null) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);
        }

        if (!req.params.guildid) {
            return next();
        }

        const guild = req.guild;

        if (guild == null) {
            return res.status(404).json(errors.response_404.UNKNOWN_GUILD);
        }

        if ((guild.owner_id == sender.id || (req.is_staff && req.staff_details.privilege >= 3))) {
            if (!sender.mfa_enabled && global.config.mfa_required_for_admin && req.is_staff) {
                return res.status(403).json(errors.response_403.MFA_REQUIRED); //move this to its own error code
            }

            return next();
        }

        let check = await global.permissions.hasGuildPermissionTo(req.guild, sender.id, permission, req.client_build);

        if (!check) {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }

        next();
    }
}

function channelPermissionsMiddleware(permission) {
    return async function (req, res, next) {
        const sender = req.account;

        if (sender == null) {
            return res.status(401).json(errors.response_401.UNAUTHORIZED);
        }

        if (permission == "MANAGE_MESSAGES" && req.params.messageid) {
            let message = req.message;

            if (message == null) {
                return res.status(404).json(errors.response_404.UNKNOWN_MESSAGE);
            }

            if (req.is_staff && req.staff_details.privilege >= 3) {
                if (!sender.mfa_enabled && global.config.mfa_required_for_admin) {
                    return res.status(403).json(errors.response_403.MFA_REQUIRED);
                }

                return next();
            }

            if (message.author.id == sender.id) {
                return next();
            }
        }

        const channel = req.channel;

        if (channel == null) {
            return res.status(404).json(errors.response_404.UNKNOWN_CHANNEL);
        }

        if (req.is_staff && req.staff_details.privilege >= 3) {
            if (!sender.mfa_enabled && global.config.mfa_required_for_admin) {
                return res.status(403).json(errors.response_403.MFA_REQUIRED);
            }

            return next();
        }

        if (channel.id.includes('12792182114301050')) return next();

        if (!channel.guild_id && channel.recipients) {
            if (permission == "MANAGE_MESSAGES" && !channel.recipients.includes(sender.id)) {
                return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
            }

            if (permission == "SEND_MESSAGES") {
                if (channel.type == 1) {
                    //Permission to DM
                    
                    //Need a complete user object for the relationships
                    let otherID = channel.recipients[channel.recipients[0].id == sender.id ? 1 : 0].id;
                    let other = await global.database.getAccountByUserId(otherID);

                    if (!other) {
                        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
                    }

                    let friends = !sender.bot && !other.bot && globalUtils.areWeFriends(sender, other);

                    const guilds = await global.database.getUsersGuilds(other.id);

                    const sharedGuilds = guilds.filter(guild => 
                        guild.members != null && 
                        guild.members.length > 0 && 
                        guild.members.some(member => member.id === sender.id)
                    );

                    if (!friends && sharedGuilds.length === 0) {
                        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
                    }

                    let counted = 0;

                    for(var guild of sharedGuilds) {
                        if (!other.bot && other.settings.restricted_guilds.includes(guild.id)) {
                            counted++;
                        }
                    }

                    if (counted === sharedGuilds.length && !friends) {        
                        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
                    }
                } else if (channel.type == 3) {
                    //Permission to send in group chat
                    if (!channel.recipients.some(x => x.id == sender.id)) {
                        return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
                    }
                }
            }

            return next();
        }

        let check = global.permissions.hasChannelPermissionTo(channel, req.guild, sender.id, permission);

        if (!check) {
            return res.status(403).json(errors.response_403.MISSING_PERMISSIONS);
        }

        next();
    }
}

module.exports = {
    corsMiddleware,
    apiVersionMiddleware,
    clientMiddleware,
    authMiddleware,
    assetsMiddleware,
    instanceMiddleware,
    rateLimitMiddleware,
    staffAccessMiddleware,
    channelMiddleware,
    guildMiddleware,
    userMiddleware,
    guildPermissionsMiddleware,
    channelPermissionsMiddleware
};