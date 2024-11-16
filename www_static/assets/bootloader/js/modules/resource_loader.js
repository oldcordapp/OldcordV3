import { patcher } from "./patcher.js";
import { utils } from "./utils.js";
import { Config } from "./config.js";

export class ResourceLoader {
  constructor() {
    // Single cache for all resource types
    this.patchedUrls = new Map();
  }

  async loadResource(path, type) {
    const normalizedPath = this.normalizeScriptPath(path);
    
    // Check cache first
    if (this.patchedUrls.has(normalizedPath)) {
      utils.loadLog(`Using cached ${type}: ${normalizedPath}`);
      return this.patchedUrls.get(normalizedPath);
    }

    utils.loadLog(`Downloading ${type}: ${normalizedPath}`);

    return utils.safeExecute(async () => {
      // For newer versions, just return the full URL for icons
      if (type === 'ico') {
        const fullUrl = normalizedPath.startsWith('http') ? 
          normalizedPath : 
          `${Config.cdn_url}${normalizedPath}`;
        return fullUrl;
      }

      const fullUrl = `${Config.cdn_url}${normalizedPath}`;
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        if (response.status === 404 && normalizedPath.startsWith("/assets/")) {
          return this.loadResource(normalizedPath.substring(8), type);
        }
        throw new Error(`Failed to download ${type} (HTTP ${response.status}): ${normalizedPath}`);
      }

      utils.loadLog(`Patching ${type}: ${normalizedPath}`);

      const content = await response.text();
      const processed = type === 'script' 
        ? patcher.js(content, "root", window.config)
        : patcher.css(content);

      const blob = new Blob([processed], { 
        type: type === 'script' ? 'application/javascript' : 'text/css' 
      });
      const blobUrl = URL.createObjectURL(blob);
      
      // Cache the result using normalizedPath
      const result = { url: fullUrl, blob: blobUrl };
      this.patchedUrls.set(normalizedPath, result);

      utils.loadLog(`Successfully loaded ${type} ${normalizedPath} as blob URL: ${blobUrl}`);
      return result;
    }, `${type} load error: ${normalizedPath}`);
  }

  loadScript(path) {
    return this.loadResource(path, 'script');
  }

  loadCSS(path) {
    return this.loadResource(path, 'css');
  }

  normalizeScriptPath(path) {
    if (path.startsWith("http")) {
      return new URL(path).pathname;
    }
    return path.startsWith("/") ? path : "/assets/" + path;
  }

  setupInterceptors() {
    utils.loadLog("Setting up resource interceptor...");
    
    const shouldIntercept = (url) => 
      typeof url === 'string' && !url.includes('/bootloader/') && !url.startsWith('blob:');

    // Intercept createElement
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tagName) => {
      const element = originalCreateElement(tagName);
      
      if (tagName.toLowerCase() === 'script') {
        Object.defineProperty(element, 'src', {
          set: (url) => this.handleScriptSrc(element, url, shouldIntercept)
        });
      }
      
      if (tagName.toLowerCase() === 'link') {
        const originalSetAttribute = element.setAttribute.bind(element);
        element.setAttribute = (name, value) => 
          this.handleLinkAttribute(element, name, value, originalSetAttribute, shouldIntercept);
      }
      
      return element;
    };

    // Intercept XHR
    this.setupXHRIntercept(shouldIntercept);

    // Intercept fetch
    this.setupFetchIntercept(shouldIntercept);
  }

  handleScriptSrc(element, url, shouldIntercept) {
    if (!shouldIntercept(url)) {
      element.setAttribute('src', url);
      return;
    }

    const normalizedUrl = this.normalizeScriptPath(url);
    if (this.patchedUrls.has(normalizedUrl)) {
      utils.loadLog(`Using cached script: ${normalizedUrl}`);
      element.setAttribute('src', this.patchedUrls.get(normalizedUrl).blob);
      return;
    }

    const xhr = new XMLHttpRequest();
    utils.loadLog(`Intercepting script: ${url}`);
    xhr.open('GET', url, false);
    xhr.send();
    
    const processed = patcher.js(xhr.responseText, 'inline', window.config);
    const blob = new Blob([processed], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    
    this.patchedUrls.set(normalizedUrl, { url, blob: blobUrl });
    element.setAttribute('src', blobUrl);
  }

  handleLinkAttribute(element, name, value, originalSetAttribute, shouldIntercept) {
    if (name !== 'href' || !value.endsWith('.css') || !shouldIntercept(value)) {
      originalSetAttribute.call(element, name, value);
      return;
    }

    const normalizedUrl = this.normalizeScriptPath(value);
    if (this.patchedUrls.has(normalizedUrl)) {
      utils.loadLog(`Using cached CSS: ${normalizedUrl}`);
      originalSetAttribute.call(element, name, this.patchedUrls.get(normalizedUrl).blob);
      return;
    }

    utils.loadLog(`Intercepting CSS: ${value}`);
    const xhr = new XMLHttpRequest();
    xhr.open('GET', value, false);
    xhr.send();
    
    const processed = patcher.css(xhr.responseText);
    const blob = new Blob([processed], { type: 'text/css' });
    const blobUrl = URL.createObjectURL(blob);
    
    this.patchedUrls.set(normalizedUrl, { url: value, blob: blobUrl });
    originalSetAttribute.call(element, name, blobUrl);
  }

  setupXHRIntercept(shouldIntercept) {
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;
    const patchedUrls = this.patchedUrls; // Store reference to cache
    
    XHR.open = function(_method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };

    XHR.send = function() {
      if (!shouldIntercept(this._url) || patchedUrls.has(this._url)) {
        return originalSend.apply(this, arguments);
      }

      const isJS = this._url.endsWith('.js');
      const isCSS = this._url.endsWith('.css');
      
      if (isJS || isCSS) {
        this.addEventListener('load', function() {
          if (this.status === 200) {
            const patched = isJS 
              ? patcher.js(this.responseText, 'inline', window.config)
              : patcher.css(this.responseText);
            Object.defineProperty(this, 'response', { value: patched });
            Object.defineProperty(this, 'responseText', { value: patched });
            patchedUrls.set(this._url, { url: this._url, blob: null, content: patched });
          }
        });
      }
      return originalSend.apply(this, arguments);
    };
  }

  setupFetchIntercept(shouldIntercept) {
    const originalFetch = window.fetch;
    const patchedUrls = this.patchedUrls;

    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      
      if (!shouldIntercept(url) || patchedUrls.has(url)) {
        return originalFetch.apply(this, arguments);
      }

      const response = await originalFetch.apply(this, arguments);
      
      if (!response.ok) {
        return response;
      }

      const isJS = url.endsWith('.js');
      const isCSS = url.endsWith('.css');

      if (!isJS && !isCSS) {
        return response;
      }

      const text = await response.text();
      const patched = isJS 
        ? patcher.js(text, 'inline', window.config)
        : patcher.css(text);

      patchedUrls.set(url, { url, blob: null, content: patched });

      return new Response(patched, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    };
  }
}
