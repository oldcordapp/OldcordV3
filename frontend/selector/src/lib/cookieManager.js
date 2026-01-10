export default {
  set(name, value, options = {}) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('Cookie name must be a non-empty string.');
    }

    if (!options.samesite) {
      options.samesite = 'Lax';
    }

    let cookieString = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;

    if (options.expires) {
      let expiresDate;
      if (typeof options.expires === 'number') {
        expiresDate = new Date();
        expiresDate.setTime(expiresDate.getTime() + options.expires * 24 * 60 * 60 * 1000);
      } else if (options.expires instanceof Date) {
        expiresDate = options.expires;
      }
      if (expiresDate) {
        cookieString += `; expires=${expiresDate.toUTCString()}`;
      }
    }

    cookieString += `; path=${options.path || '/'}`;
    if (options.domain) {
      cookieString += `; domain=${options.domain}`;
    }
    if (options.samesite === 'None') {
      options.secure = true;
    }
    if (options.secure) {
      cookieString += '; secure';
    }
    cookieString += `; samesite=${options.samesite}`;

    document.cookie = cookieString;
  },
  get(name) {
    if (typeof name !== 'string' || name.length === 0) return null;

    const cookies = document.cookie.split(';').map((c) => c.trim());
    const targetCookie = `${encodeURIComponent(name)}=`;

    for (const cookie of cookies) {
      if (cookie.startsWith(targetCookie)) {
        return decodeURIComponent(cookie.substring(targetCookie.length));
      }
    }
    return null;
  },

  getAll() {
    if (document.cookie === '') return {};

    return document.cookie.split(';').reduce((acc, cookie) => {
      const [key, ...value] = cookie.trim().split('=');
      acc[decodeURIComponent(key)] = decodeURIComponent(value.join('='));
      return acc;
    }, {});
  },
  remove(name, options = {}) {
    this.set(name, '', {
      ...options,
      expires: -1,
    });
  },

  has(name) {
    return this.get(name) !== null;
  },
};
