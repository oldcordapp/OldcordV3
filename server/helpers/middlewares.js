const rateLimit = require('express-rate-limit');
const { logText } = require('./logger');
const globalUtils = require('./globalutils');
const wayback = require('./wayback');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

const config = globalUtils.config;

const spacebarApis = ["/.well-known/spacebar", "/policies/instance/domains"];

let cached404s = {};
let bucket = null;

if (config.gcs_config && config.gcs_config.autoUploadBucket && config.gcs_config.autoUploadBucket !== "") {
    let storage = new Storage();

    bucket = storage.bucket(config.gcs_config.autoUploadBucket);
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

        if ((!cookies) || (!cookies['release_date'] && !isSameHost)) {
            cookies['release_date'] = "thirdPartyOrMobile"
            res.cookie('release_date', "thirdPartyOrMobile")
        }

        if (!cookies['release_date'] && isSameHost && !config.require_release_date_cookie) {
            res.cookie('release_date', config.default_client_build || "october_5_2017", {
                maxAge: 100 * 365 * 24 * 60 * 60 * 1000
            });
        }

        if ((!cookies['default_client_build'] || cookies['default_client_build'] !== (config.default_client_build || "october_5_2017")) && isSameHost) {
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
        
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
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
                message: "You are being rate limited.",
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
        
        let bodyText = await r.text();

        if (bucket !== null) {
            let path = `${config.gcs_config.gcStorageFolder}/${req.params.asset}`;

            const cloudFile = bucket.file(path);

            await cloudFile.save(bodyText, { contentType: r.headers.get("content-type") });

            logText(`[LOG] Uploaded ${req.params.asset} to Google Cloud Storage successfully.`, 'debug');
        }

        fs.writeFileSync(filePath, bodyText);

        logText(`[LOG] Saved ${req.params.asset} from ${snapshot_url} successfully.`, 'debug');

        res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") });
        res.status(r.status).end(bodyText);
    }

    await handleRequest(doWayback);
}

function staffAccessMiddleware(privilege_needed) {
    return async function (req, res, next) {
        try {
            let account = req.account;

            if (!account) {
                return res.status(401).json({
                    code: 401,
                    message: "Unauthorized"
                });
            }

            if (!req.is_staff) {
                return res.status(401).json({
                    code: 401,
                    message: "Unauthorized"
                });
            }

            if (req.staff_details.privilege < privilege_needed) {
                return res.status(401).json({
                    code: 401,
                    message: "Unauthorized"
                });
            }

            next();
        } catch(err) {
            logText(err, "error");

            return res.status(500).json({
                code: 500,
                message: "Internal Server Error"
            });
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
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
        }

        let account = await global.database.getAccountByToken(token);
    
        if (!account) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
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
                let decodedProperties = Buffer.from(xSuperProperties, "base64").toString("utf-8");

                if (!xSuperProperties || !userAgent || userAgent.length < 5 || xSuperProperties === "{}" || !decodedProperties || decodedProperties.length < 5) {
                    req.cannot_pass = true;
                }

                if (!/^\{"os":"[^"]+","browser":"[^"]+","device":"[^"]*","referrer":"https?:\/\/[^"]+","referring_domain":"[^"]+"\}$/.test(decodedProperties)) {
                    req.cannot_pass = true;
                }
            } catch { }
        }

        if (req.cannot_pass) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
        }

        req.account = account;

        next();
    }
    catch(err) {
        logText(err, "error");

        return res.status(401).json({
            code: 401,
            message: "Unauthorized"
        });
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

                return res.status(403).json({
                    code: 403,
                    message: "You must verify your e-mail address to do this action."
                }); 
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
        return res.status(404).json({
            code: 404,
            message: "Unknown Guild"
        });
    }

    const sender = req.account;

    if (sender == null) {
        return res.status(401).json({
            code: 401,
            message: "Unauthorized"
        });
    }

    if (req.is_staff) {
        return next();
    }

    let member = guild.members.find(y => y.id == sender.id);

    if (!member) {
        return res.status(404).json({
            code: 404,
            message: "Unknown Guild"
        });
    }

    next();
}

async function userMiddleware(req, res, next) {
    let account = req.account;

    if (!account) {
        return res.status(401).json({
            code: 401,
            message: "Unauthorized"
        });
    }

    let user = req.user;

    if (!user) {
        return res.status(404).json({
            code: 404,
            message: "Unknown User"
        });
    }

    if (globalUtils.areWeFriends(account, user)) {
        return next();
    }

    let guilds = await global.database.getUsersGuilds(user.id);

    if (guilds.length == 0) {
        return res.status(404).json({
            code: 404,
            message: "Unknown User"
        });
    } //investigate later

    let share = guilds.some(guild => guild.members != null && guild.members.length > 0 && guild.members.some(member => member.id === account.id));

    if (!share) {
        return res.status(404).json({
            code: 404,
            message: "Unknown User"
        });
    }

    next();
}

async function channelMiddleware(req, res, next) {
    let channel = req.channel;

    if (!channel) {
        return res.status(404).json({
            code: 404,
            message: "Unknown Channel"
        });
    }

    if (!channel.guild_id) {
        return next();
    }

    if (!req.params.guildid) {
        req.params.guildid = channel.guild_id;
    }

    const sender = req.account;

    if (!sender) {
        return res.status(500).json({
            code: 500,
            message: "Internal Server Error"
        });
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
        return res.status(403).json({
            code: 403,
            message: "Missing Permissions"
        });
    }

    let gCheck = await global.permissions.hasGuildPermissionTo(req.guild, member.id, "READ_MESSAGES", req.client_build);

    if (!gCheck) {
        return res.status(403).json({
            code: 403,
            message: "Missing Permissions"
        });
    }

    let pCheck = await global.permissions.hasChannelPermissionTo(req.channel, req.guild, member.id, "READ_MESSAGES");

    if (!pCheck) {
        return res.status(403).json({
            code: 403,
            message: "Missing Permissions"
        });
    }

    next();
}

function guildPermissionsMiddleware(permission) {
    return async function (req, res, next) {
        const sender = req.account;

        if (sender == null) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
        }

        if (!req.params.guildid) {
            return next();
        }

        const guild = req.guild;

        if (guild == null) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Guild"
            });
        }

        if (guild.owner_id == sender.id || (req.is_staff && req.staff_details.privilege >= 3)) {
            return next();
        }

        let check = await global.permissions.hasGuildPermissionTo(req.guild, sender.id, permission, req.client_build);

        if (!check) {
            return res.status(403).json({
                code: 403,
                message: "Missing Permissions"
            });
        }

        next();
    }
}

function channelPermissionsMiddleware(permission) {
    return async function (req, res, next) {
        const sender = req.account;

        if (sender == null) {
            return res.status(401).json({
                code: 401,
                message: "Unauthorized"
            });
        }

        if (permission == "MANAGE_MESSAGES" && req.params.messageid) {
            let message = req.message;

            if (message == null) {
                return res.status(404).json({
                    code: 404,
                    message: "Unknown Message"
                });
            }

            if (req.is_staff && req.staff_details.privilege >= 3) {
                return next();
            }

            if (message.author.id == sender.id) {
                return next();
            }
        }

        const channel = req.channel;

        if (channel == null) {
            return res.status(404).json({
                code: 404,
                message: "Unknown Channel"
            });
        }

        if (req.is_staff && req.staff_details.privilege >= 3) {
            return next();
        }

        if (channel.id.includes('12792182114301050')) return next();

        if (!channel.guild_id && channel.recipients) {
            if (permission == "MANAGE_MESSAGES" && !channel.recipients.includes(sender.id)) {
                return res.status(403).json({
                    code: 403,
                    message: "Missing Permissions"
                });
            }

            if (permission == "SEND_MESSAGES") {
                if (channel.type == 1) {
                    //Permission to DM
                    
                    //Need a complete user object for the relationships
                    let otherID = channel.recipients[channel.recipients[0].id == sender.id ? 1 : 0].id;
                    let other = await global.database.getAccountByUserId(otherID);

                    if (!other) {
                        return res.status(403).json({
                            code: 403,
                            message: "Missing Permissions"
                        });
                    }

                    let friends = !sender.bot && !other.bot && globalUtils.areWeFriends(sender, other);

                    const guilds = await global.database.getUsersGuilds(other.id);

                    const sharedGuilds = guilds.filter(guild => 
                        guild.members != null && 
                        guild.members.length > 0 && 
                        guild.members.some(member => member.id === sender.id)
                    );

                    if (!friends && sharedGuilds.length === 0) {
                        return res.status(403).json({
                            code: 403,
                            message: "Missing Permissions"
                        });
                    }

                    let counted = 0;

                    for(var guild of sharedGuilds) {
                        if (!other.bot && other.settings.restricted_guilds.includes(guild.id)) {
                            counted++;
                        }
                    }

                    if (counted === sharedGuilds.length && !friends) {        
                        return res.status(403).json({
                            code: 403,
                            message: "Missing Permissions"
                        });
                    }
                } else if (channel.type == 3) {
                    //Permission to send in group chat
                    if (!channel.recipients.some(x => x.id == sender.id)) {
                        return res.status(403).json({
                            code: 403,
                            message: "Missing Permissions"
                        });
                    }
                }
            }

            return next();
        }

        let check = await global.permissions.hasChannelPermissionTo(channel, req.guild, sender.id, permission);

        if (!check) {
            return res.status(403).json({
                code: 403,
                message: "Missing Permissions"
            });
        }

        next();
    }
}

module.exports = {
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