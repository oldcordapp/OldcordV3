import { patcher } from "./patcher.js";
import { utils } from "./utils.js";
import { Config } from "./config.js";

export class ResourceLoader {
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
        const url = normalizedPath.startsWith('http') ? 
          normalizedPath : 
          `${Config.cdn_url}${normalizedPath}`;
        return url;
      }

      const response = await fetch(`${Config.cdn_url}${normalizedPath}`);
      
      if (!response.ok) {
        if (response.status === 404 && normalizedPath.startsWith("/assets/")) {
          return this.loadResource(normalizedPath.substring(8), type);
        }
        throw new Error(`Failed to download ${type} (HTTP ${response.status}): ${normalizedPath}`);
      }

      // Handle ico files differently - return direct URL
      if (type === 'ico') {
        return `${Config.cdn_url}${normalizedPath}`;
      }

      const content = await response.text();
      const processed = type === 'script' 
        ? patcher.js(content, "root", window.config)
        : patcher.css(content);

      return URL.createObjectURL(
        new Blob([processed], { type: type === 'script' ? 'application/javascript' : 'text/css' })
      );
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
}
