import { patcher } from "./patcher.js";
import { utils } from "./utils.js";
import { Config } from "./config.js";

export class ResourceLoader {
  constructor(patchedResources) {
    this.patchedResources = patchedResources;
  }

  async loadResource(path, type) {
    // Skip processing if it's a base64 encoded image
    if (type === 'ico' && path.startsWith('data:')) {
      return path;
    }

    const normalizedPath = this.normalizeScriptPath(path);
    utils.loadLog(`Downloading ${type}: ${normalizedPath}`);

    return utils.safeExecute(async () => {
      // For newer versions, just return the full URL for icons
      if (type === 'ico') {
        return normalizedPath.startsWith('http') ? 
          normalizedPath : 
          `${Config.cdn_url}${normalizedPath}`;
      }

      const response = await fetch(`${Config.cdn_url}${normalizedPath}`);
      
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
      return blobUrl;
    }, `${type} load error: ${normalizedPath}`);
  }

  loadScript(path) {
    return this.loadResource(path, 'script');
  }

  loadCSS(path) {
    return this.loadResource(path, 'css');
  }

  loadIcon(path) {
    return this.loadResource(path, 'ico');
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
  }

  handleScriptSrc(element, url, shouldIntercept) {
    const xhr = new XMLHttpRequest();
    if (shouldIntercept(url) && !this.patchedResources.has(element)) {
      utils.loadLog(`Intercepting script: ${url}`);
      xhr.open('GET', url, false);
      xhr.send();
      const patched = patcher.js(xhr.responseText, 'inline', window.config);
      const blob = new Blob([patched], { type: 'application/javascript' });
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
      const patched = patcher.css(xhr.responseText);
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
}
