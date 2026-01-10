export const utils = {
  isDebugMode() {
    return document.cookie.includes('debug_mode=true');
  },

  isOldplungerEnabled() {
    return document.cookie.includes('oldplunger_enabled=true');
  },

  loadLog(message, status = 'info') {
    const logsElement = document.getElementById('oldcord-loading-logs');
    if (!logsElement) return;

    const shouldShow = status !== 'info' || this.isDebugMode();

    shouldShow && console.log(`[Oldcord bootloader] ${message}`);

    const logElement = document.createElement('div');
    logElement.textContent = message;
    if (status === 'error') logElement.className = 'error-log';
    else if (status === 'warning') logElement.className = 'warning-log';

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
    const parts = `; ${document.cookie}`.split('; release_date=');
    return parts.length === 2 ? parts.pop().split(';').shift() : null;
  },

  getDefaultClientBuild() {
    const parts = `; ${document.cookie}`.split('; default_client_build=');
    return parts.length === 2 ? parts.pop().split(';').shift() : 'october_5_2017';
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
      this.loadLog(errorMessage || error.message, 'error');
      throw error;
    }
  },

  getGlobalConfig() {
    return window.oldcord.config || {};
  },

  getChunkCache() {
    try {
      const cache = localStorage.getItem('oldcord_chunk_cache');
      return cache ? JSON.parse(cache) : {};
    } catch {
      return {};
    }
  },

  saveChunkCache(buildId, hash, urls) {
    try {
      const cache = this.getChunkCache();
      if (!cache[buildId]) cache[buildId] = {};
      cache[buildId][hash] = urls;
      localStorage.setItem('oldcord_chunk_cache', JSON.stringify(cache));
    } catch {
      // Ignore storage errors
    }
  },

  getChunkUrls(buildId, hash) {
    try {
      return this.getChunkCache()?.[buildId]?.[hash];
    } catch {
      return null;
    }
  },

  getFailedChunks(buildId) {
    try {
      const failed = localStorage.getItem('oldcord_failed_urls');
      return failed ? JSON.parse(failed)?.[buildId] || [] : [];
    } catch {
      return [];
    }
  },

  saveFailedChunk(buildId, url) {
    try {
      const failed = JSON.parse(localStorage.getItem('oldcord_failed_urls') || '{}');
      if (!failed[buildId]) failed[buildId] = [];
      if (!failed[buildId].includes(url)) {
        failed[buildId].push(url);
        localStorage.setItem('oldcord_failed_urls', JSON.stringify(failed));
      }
    } catch {
      // Ignore storage errors
    }
  },
};
