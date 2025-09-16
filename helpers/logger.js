let properties = {
    ignoreDebug: false,
    disabled: false,
    fullErrors: true
};

const logText = (text, type) => {
    if (properties.disabled || (type == 'debug' && properties.ignoreDebug)) {
        return;
    }

    if (!global.config.debugLogs) {
        global.config.debugLogs = {
            gateway: true,
            rtc: true,
            media: true,
            udp: true,
            rest: true,
            dispatcher: true,
            errors: true
        } //compatibility
    }

    if (!global.config.debugLogs['errors'] && type === 'error') {
        return;
    }

    if (!global.config.debugLogs['dispatcher'] && type === 'dispatcher') {
        return;
    }

    let restTags = [
        'oldcord',
        'debug',
        'emailer'
    ]

    if (!global.config.debugLogs['rest'] && restTags.includes(type.toLowerCase())) {
        return;
    }

    if (type !== 'error') {
        console.log(`[OLDCORDV3] <${type.toUpperCase()}>: ${text}`);
        return;
    }

    if (properties.fullErrors) {
        console.error(text);
        return;
    }

    let stack = text.stack;
    let functionname = stack.split('\n')[1].trim().split(' ')[1] || '<anonymous>';
    let message = text.toString();

    console.error(`[OLDCORDV3] ERROR @ ${functionname} -> ${message}`);
};

module.exports = { 
    logText 
};