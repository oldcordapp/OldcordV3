import { patcher } from "./patcher.js";
import { utils } from "./utils.js";
import { Config } from "./config.js";

export class ResourceLoader {
  constructor(patchedResources) {
    this.patchedResources = patchedResources;
  }

  async loadResource(path, type) {
    const normalizedPath = this.normalizeScriptPath(path);
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
      this.patchedResources.set(blob, true);
      const blobUrl = URL.createObjectURL(blob);

      utils.loadLog(`Successfully loaded ${type} ${normalizedPath} as blob URL: ${blobUrl}`);
      return { url: fullUrl, blob: blobUrl };
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
    const xhr = new XMLHttpRequest();
    if (shouldIntercept(url) && !this.patchedResources.has(element)) {
      utils.loadLog(`Intercepting script: ${url}`);
      xhr.open('GET', url, false);
      xhr.send();
      const blob = new Blob([xhr.responseText], { type: 'application/javascript' });
      this.patchedResources.set(element, true);
      element.setAttribute('src', URL.createObjectURL(blob));
    } else {
      element.setAttribute('src', url);
    }
  }

  handleLinkAttribute(element, name, value, originalSetAttribute, shouldIntercept) {
    if (name === 'href' && value.endsWith('.css') && 
        shouldIntercept(value) && !this.patchedResources.has(element)) {
      utils.loadLog(`Intercepting CSS: ${value}`);
      const xhr = new XMLHttpRequest();
      xhr.open('GET', value, false);
      xhr.send();
      const blob = new Blob([patched], { type: 'text/css' });
      this.patchedResources.set(element, true);
      originalSetAttribute.call(element, name, URL.createObjectURL(blob));
    } else {
      originalSetAttribute.call(element, name, value);
    }
  }

  setupXHRIntercept(shouldIntercept) {
    const XHR = XMLHttpRequest.prototype;
    const originalOpen = XHR.open;
    const originalSend = XHR.send;
    const patchedResources = this.patchedResources; // Store reference
    
    XHR.open = function(_method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };

    XHR.send = function() {
      if (shouldIntercept(this._url) && !patchedResources.has(this)) {
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
              patchedResources.set(this, true);
            }
          });
        }
      }
      return originalSend.apply(this, arguments);
    };
  }

  setupFetchIntercept(shouldIntercept) {
    const originalFetch = window.fetch;
    const patchedResources = this.patchedResources;

    window.fetch = async function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      
      if (!shouldIntercept(url)) {
        return originalFetch.apply(this, arguments);
      }

      const response = await originalFetch.apply(this, arguments);
      
      if (!response.ok || !patchedResources.has(response)) {
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

      patchedResources.set(response, true);

      return new Response(patched, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    };
  }
}
