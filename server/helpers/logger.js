let properties = {
  ignoreDebug: false,
  disabled: false,
  fullErrors: true,
};

const logText = (text, type) => {
  if (properties.disabled || (type == 'debug' && properties.ignoreDebug)) {
    return;
  }

  if (!global.config.debug_logs) {
    global.config.debug_logs = {
      gateway: true,
      rtc: true,
      media: true,
      udp: true,
      rest: true,
      dispatcher: true,
      errors: true,
      watchdog: true,
    }; //compatibility
  }

  if (!global.config.debug_logs['errors'] && type === 'error') {
    return;
  }

  if (!global.config.debug_logs['dispatcher'] && type === 'dispatcher') {
    return;
  }

  if (!global.config.debug_logs['watchdog'] && type === 'watchdog') {
    return;
  }

  let restTags = ['oldcord', 'debug', 'emailer'];

  if (!global.config.debug_logs['rest'] && restTags.includes(type.toLowerCase())) {
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
  logText,
};
