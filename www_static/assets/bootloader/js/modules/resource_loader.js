import { patcher } from "./patcher.js";
import { utils } from "./utils.js";
import { Config } from "./config.js";

export class ResourceLoader {
  constructor() {
    this.patchedUrls = new Map();
    this.chunkRegex =
      /[{,]\s*(?:"|')?(\d+)(?:"|')?\s*:\s*(?:"|')([0-9a-f]{20,})(?:"|')/g;
    this.onChunkProgress = null;
  }

  async loadResource(path, type) {
    const normalizedPath = this.normalizeScriptPath(path);

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
          if (
            response.status === 404 &&
            normalizedPath.startsWith("/assets/")
          ) {
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

        // Find if a script has chunks
        if (type === "script") {
          await this.preloadChunks(content);
        }

        const blob = new Blob([processed], {
          type: type === "script" ? "application/javascript" : "text/css",
        });
        const blobUrl = URL.createObjectURL(blob);

        const result = { url: fullUrl, blob: blobUrl };
        this.patchedUrls.set(normalizedPath, result);

        utils.loadLog(
          `Successfully loaded ${type} ${normalizedPath} as blob URL: ${blobUrl}`
        );
        return result;
      } catch (error) {
        if (error.message.startsWith("HTTP ")) return null;
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
        let blobUrl = null;
        Object.defineProperty(element, "src", {
          get: () => srcValue,
          set: (url) => {
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
            }
            srcValue = this.handleScriptSrc(element, url, shouldIntercept);
            if (srcValue.startsWith("blob:")) {
              blobUrl = srcValue;
            }
            return true;
          },
          configurable: true,
        });
      }

      if (tagName.toLowerCase() === "link") {
        let hrefValue = "";
        let blobUrl = null;
        Object.defineProperty(element, "href", {
          get: () => hrefValue,
          set: (url) => {
            if (blobUrl) {
              URL.revokeObjectURL(blobUrl);
            }
            hrefValue = this.handleLinkAttribute(
              element,
              "href",
              url,
              (_, val) => {
                element.setAttribute("href", val);
              },
              shouldIntercept
            );
            if (hrefValue.startsWith("blob:")) {
              blobUrl = hrefValue;
            }
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
      originalSetAttribute.call(
        element,
        name,
        "https://missing.discord.b3BlcmF0"
      );
      return "https://missing.discord.b3BlcmF0";
    }
  }

  extractChunkUrls(content) {
    const urlsByHash = new Map();
    let match;

    while ((match = this.chunkRegex.exec(content)) !== null) {
      const [_, id, hash] = match;
      if (!urlsByHash.has(hash)) {
        urlsByHash.set(hash, [
          `/assets/${id}.${hash}.js`,
          `/assets/${hash}.js`,
          `/assets/${hash}.css`,
        ]);
      }
    }

    return urlsByHash;
  }

  async findChunk(urls, hash) {
    const timeout = 10000;

    for (const url of urls) {
      const normalizedUrl = this.normalizeScriptPath(url);

      if (utils.getFailedChunks(window.release_date).includes(normalizedUrl)) {
        continue;
      }

      try {
        const fullUrl = `${Config.cdn_url}${normalizedUrl}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(fullUrl, {
          method: "HEAD",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 200) {
          utils.saveChunkCache(window.release_date, hash, [normalizedUrl]);
          return normalizedUrl;
        } else {
          utils.saveFailedChunk(window.release_date, normalizedUrl);
        }
      } catch (error) {
        if (error.name === "AbortError") {
          utils.loadLog(`Chunk request timeout: ${normalizedUrl}`, "warning");
        }
        utils.saveFailedChunk(window.release_date, normalizedUrl);
      }
    }
    return null;
  }

  async loadChunk(url, hash) {
    const normalizedUrl = this.normalizeScriptPath(url);

    try {
      const fullUrl = `${Config.cdn_url}${normalizedUrl}`;
      utils.loadLog(`Loading chunk ${hash}: ${normalizedUrl}`);

      const response = await fetch(fullUrl);
      const text = await response.text();
      const processed = patcher.js(text, "chunk", window.config);
      const blob = new Blob([processed], { type: "application/javascript" });
      const blobUrl = URL.createObjectURL(blob);

      this.patchedUrls.set(normalizedUrl, { url: fullUrl, blob: blobUrl });
      utils.loadLog(`Successfully patched chunk: ${normalizedUrl}`);
      return true;
    } catch (error) {
      utils.loadLog(`Failed to load chunk ${normalizedUrl}`, "error");
      return false;
    }
  }

  async preloadChunks(content) {
    const urlsByHash = this.extractChunkUrls(content);
    if (urlsByHash.size === 0) {
      this.onChunkProgress?.(1, 1, "find");
      return;
    }

    utils.loadLog(`Found ${urlsByHash.size} potential chunks`);

    let findProgress = 0;
    const chunksToLoad = [];
    const chunks = [...urlsByHash.entries()];

    // Process chunks in smaller batches to avoid overwhelming
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ([hash, urls]) => {
          try {
            const cachedUrl = utils.getChunkUrls(
              window.release_date,
              hash
            )?.[0];
            if (cachedUrl) {
              chunksToLoad.push([hash, cachedUrl]);
            } else {
              const validUrl = await this.findChunk(urls, hash);
              if (validUrl) {
                chunksToLoad.push([hash, validUrl]);
              }
            }
          } catch (error) {
            utils.loadLog(`Failed to process chunk ${hash}: ${error}`, "error");
          } finally {
            findProgress++;
            this.onChunkProgress?.(findProgress, urlsByHash.size, "find");
          }
        })
      );
    }

    utils.loadLog(`Found ${chunksToLoad.length} loadable chunks`);

    if (chunksToLoad.length > 0) {
      let loadProgress = 0;
      await Promise.all(
        chunksToLoad.map(async ([hash, url]) => {
          await this.loadChunk(url, hash);
          loadProgress++;
          this.onChunkProgress?.(loadProgress, chunksToLoad.length, "load");
        })
      );
    }
  }
}
