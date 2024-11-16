import { patcher } from "./patcher.js";
import { utils } from "./utils.js";
import { Config } from "./config.js";

export class ResourceLoader {
  constructor() {
    // Single cache for all resource types
    this.patchedUrls = new Map();
    this.chunkRegex = /[{,]\s*(?:"|')?(\d+)(?:"|')?\s*:\s*(?:"|')([0-9a-f]{20,})(?:"|')/g;
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
      if (type === "ico") {
        const fullUrl = normalizedPath.startsWith("http")
          ? normalizedPath
          : `${Config.cdn_url}${normalizedPath}`;
        return fullUrl;
      }

      const fullUrl = `${Config.cdn_url}${normalizedPath}`;
      try {
        const response = await fetch(fullUrl);

        if (!response.ok) {
          if (response.status === 404 && normalizedPath.startsWith("/assets/")) {
            return this.loadResource(normalizedPath.substring(8), type);
          }
          throw new Error(`HTTP ${response.status}`);
        }

        utils.loadLog(`Patching ${type}: ${normalizedPath}`);

        const content = await response.text();
        const processed =
          type === "script"
            ? patcher.js(content, "root", window.config)
            : patcher.css(content);

        // Preload chunks if this is a script
        if (type === "script") {
          await this.preloadChunks(content);
        }

        const blob = new Blob([processed], {
          type: type === "script" ? "application/javascript" : "text/css",
        });
        const blobUrl = URL.createObjectURL(blob);

        // Cache the result using normalizedPath
        const result = { url: fullUrl, blob: blobUrl };
        this.patchedUrls.set(normalizedPath, result);

        utils.loadLog(
          `Successfully loaded ${type} ${normalizedPath} as blob URL: ${blobUrl}`
        );
        return result;
      } catch (error) {
        // Silently fail for any HTTP error
        if (error.message.startsWith('HTTP ')) return null;
        // Re-throw other errors (network, etc)
        throw error;
      }
    }, `${type} load error: ${normalizedPath}`);
  }

  loadScript(path) {
    return this.loadResource(path, "script");
  }

  loadCSS(path) {
    return this.loadResource(path, "css");
  }

  normalizeScriptPath(path) {
    if (path.startsWith("http")) {
      return new URL(path).pathname;
    }
    const url = path.startsWith("/") ? path : "/assets/" + path;
    return url;
  }

  setupInterceptors() {
    utils.loadLog("Setting up resource interceptor...");

    const shouldIntercept = (url) =>
      typeof url === "string" &&
      !url.includes("/bootloader/") &&
      !url.startsWith("blob:");

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tagName) => {
      const element = originalCreateElement(tagName);

      if (tagName.toLowerCase() === "script") {
        let srcValue = "";
        Object.defineProperty(element, "src", {
          get: () => srcValue,
          set: (url) => {
            srcValue = this.handleScriptSrc(element, url, shouldIntercept);
            return true;
          },
          configurable: true,
        });
      }

      if (tagName.toLowerCase() === "link") {
        let hrefValue = "";
        Object.defineProperty(element, "href", {
          get: () => hrefValue,
          set: (url) => {
            hrefValue = this.handleLinkAttribute(
              element,
              "href",
              url,
              (_, val) => {
                element.setAttribute("href", val);
              },
              shouldIntercept
            );
            return true;
          },
          configurable: true,
        });
      }

      return element;
    };
  }

  handleScriptSrc(element, url, shouldIntercept) {
    if (!shouldIntercept(url)) {
      element.setAttribute("src", url);
      return url;
    }

    const normalizedUrl = this.normalizeScriptPath(url);
    if (this.patchedUrls.has(normalizedUrl)) {
      utils.loadLog(`Using cached script: ${normalizedUrl}`);
      const cached = this.patchedUrls.get(normalizedUrl);
      element.setAttribute("src", cached.blob);
      return cached.blob;
    } else {
      element.setAttribute("src", "https://missing.discord.b3BlcmF0");
      return "https://missing.discord.b3BlcmF0";
    }
  }

  handleLinkAttribute(
    element,
    name,
    value,
    originalSetAttribute,
    shouldIntercept
  ) {
    if (name !== "href" || !value.endsWith(".css") || !shouldIntercept(value)) {
      originalSetAttribute.call(element, name, value);
      return value;
    }

    const normalizedUrl = this.normalizeScriptPath(value);
    if (this.patchedUrls.has(normalizedUrl)) {
      utils.loadLog(`Using cached CSS: ${normalizedUrl}`);
      const cached = this.patchedUrls.get(normalizedUrl);
      originalSetAttribute.call(element, name, cached.blob);
      return cached.blob;
    } else {
      originalSetAttribute.call(element, name, "https://missing.discord.b3BlcmF0");
      return "https://missing.discord.b3BlcmF0";
    }
  }

  extractChunkUrls(content) {
    const urls = new Set();
    let match;
    
    while ((match = this.chunkRegex.exec(content)) !== null) {
      const [_, id, hash] = match;
      const variations = [
        `/assets/${id}.${hash}.js`,
        `/assets/${hash}.js`,
        `/assets/${hash}.css`
      ];
      
      variations.forEach(url => urls.add(url));
    }
    
    return Array.from(urls);
  }

  async preloadChunks(content) {
    const urls = this.extractChunkUrls(content);
    utils.loadLog(`Found ${urls.length} potential chunk URLs`);

    // Keep track of processed hashes to avoid duplicates
    const processedHashes = new Set();

    // Fetch all URLs in parallel
    await Promise.all(
      urls.map(async (url) => {
        try {
          const normalizedUrl = this.normalizeScriptPath(url);
          if (this.patchedUrls.has(normalizedUrl)) return;

          // Skip if we already processed a URL with this hash
          const hash = url.match(/[0-9a-f]{8,}/)?.[0];
          if (hash && processedHashes.has(hash)) return;

          const fullUrl = `${Config.cdn_url}${normalizedUrl}`;
          const response = await fetch(fullUrl).catch(() => ({ ok: false })); // Catch network errors

          if (!response.ok) return;

          // If successful, mark this hash as processed
          if (hash) processedHashes.add(hash);

          utils.loadLog(`Found chunk: ${normalizedUrl}`);
          const text = await response.text();
          const processed = patcher.js(text, "chunk", window.config);
          const blob = new Blob([processed], {
            type: "application/javascript",
          });
          const blobUrl = URL.createObjectURL(blob);

          this.patchedUrls.set(normalizedUrl, { url: fullUrl, blob: blobUrl });

        } catch {
          // Completely silent for any error
        }
      })
    );
  }
}
