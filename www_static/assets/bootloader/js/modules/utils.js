export const utils = {
  isDebugMode() {
    return document.cookie.includes('debug_mode=true');
  },

  loadLog(message, isError = false, isWarning = false) {
    const logsElement = document.getElementById('oldcord-loading-logs');
    if (!logsElement) return;

    // Only show logs if it's an error/warning or debug mode is enabled
    const shouldShow = isError || isWarning || this.isDebugMode();
    
    const logElement = document.createElement('div');
    logElement.textContent = message;
    if (isError) logElement.className = 'error-log';
    else if (isWarning) logElement.className = 'warning-log';
    
    logsElement.appendChild(logElement);
    logsElement.scrollTop = logsElement.scrollHeight;

    if (shouldShow && !logsElement.classList.contains('visible')) {
      logsElement.classList.add('visible');
    }
  },

  async timer(ms) {
    return new Promise((res) => setTimeout(res, ms));
  },

  getReleaseDate() {
    const parts = `; ${document.cookie}`.split("; release_date=");
    return parts.length === 2 ? parts.pop().split(";").shift() : null;
  },

  getOriginalBuild() {
    const parts = `; ${document.cookie}`.split("; original_build=");
    return parts.length === 2 ? parts.pop().split(";").shift() : null;
  },

  setCookie(name, value) {
    document.cookie = `${name}=${value}; path=/`;
  },

  removeCookie(name) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`;
  },

  async safeExecute(action, errorMessage) {
    try {
      return await action();
    } catch (error) {
      this.loadLog(errorMessage || error.message, true);
      throw error;
    }
  },

  getGlobalConfig() {
    return window.config || {};
  }
};
