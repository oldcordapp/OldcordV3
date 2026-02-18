import { Innertube } from 'youtubei.js';
const innertube = await Innertube.create();

import { load } from 'cheerio';
import path from 'fs';
import { Jimp } from 'jimp';

import globalUtils from './utils/globalutils.js';
import { logText } from './utils/logger.ts';

const hexToDecimal = (hex) => {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  return parseInt(hex, 16);
};

const embedder = {
  embed_cache: [],
  getEmbedInfo: async (url) => {
    try {
      const content = await fetch(url, {
        headers: {
          'User-Agent': 'Bot: Mozilla/5.0 (compatible; Oldcordbot/2.0; +https://oldcordapp.com)',
        },
      });

      if (!content.ok) {
        return null;
      }

      let fetch2;
      let image_buffer;
      let image_data;

      if (
        url.endsWith('.png') ||
        url.endsWith('.jpg') ||
        url.endsWith('.jpeg') ||
        url.endsWith('.gif')
      ) {
        image_buffer = await content.arrayBuffer();
        image_data = await Jimp.read(image_buffer);

        return {
          color: 7506394,
          title: '',
          description: '',
          image: {
            url: url,
            width: image_data.bitmap.width ?? 400,
            height: image_data.bitmap.height ?? 400,
          },
        };
      }

      const text = await content.text();
      const $ = load(text);
      const videoUrl =
        $('meta[property="og:video"]').attr('content') ||
        $('meta[property="twitter:player:stream"]').attr('content');
      const videoWidth =
        parseInt(
          $('meta[property="og:video:width"]').attr('content') ||
          $('meta[property="twitter:player:width"]').attr('content'),
        ) || 480;
      const videoHeight =
        parseInt(
          $('meta[property="og:video:height"]').attr('content') ||
          $('meta[property="twitter:player:height"]').attr('content'),
        ) || 270;
      const description = $('meta[name="description"]').attr('content');
      const themeColor = $('meta[name="theme-color"]').attr('content');
      const ogTitle = $('meta[property="og:title"]').attr('content');
      let ogImage = $('meta[property="og:image"]').attr('content');

      let { ogImageWidth, ogImageHeight } = [$('meta[property="og:image:width"]').attr('content'), $('meta[property="og:image:height"]').attr('content')];

      const twitterImage = $('meta[property="twitter:image"]').attr('content');

      if (!ogImage && twitterImage) {
        ogImage = twitterImage;
      }

      const should_embed = !!(description || themeColor || ogTitle || ogImage);

      if (!should_embed) {
        return null;
      }

      const color = themeColor ? hexToDecimal(themeColor) : 7506394;
      const title = ogTitle || $('title').text() || '';

      const embedObj = {
        color: color,
        title: title,
        description: description,
      };

      if (ogImage) {
        const full_img = new URL(ogImage, url).href;

        fetch2 = await fetch(full_img, {
          headers: {
            'User-Agent': 'Bot: Mozilla/5.0 (compatible; Oldcordbot/2.0; +https://oldcordapp.com)',
          },
        });

        if (fetch2.ok) {
          image_buffer = await fetch2.arrayBuffer();

          try {
            image_data = await Jimp.read(image_buffer);
          } catch (err) {
            logText(
              `Jimp failed to read image to calculate dimensions for getEmbedInfo: ${ogImage}: ${err}`,
              'error',
            );

            image_data = null;
          }
        } else {
          image_data = null;
        }
      }

      if (ogImage && image_data) {
        const full_img = new URL(ogImage, url).href;

        embedObj.image = {
          url: full_img,
          width: ogImageWidth ?? image_data.bitmap.width ?? 400,
          height: ogImageHeight ?? image_data.bitmap.height ?? 400,
        };
      }

      if (videoUrl) {
        embedObj.video = {
          url: videoUrl,
          width: videoWidth,
          height: videoHeight,
        };
      }

      return should_embed ? embedObj : null;
    } catch (error) {
      logText(error, 'error');

      return null;
    }
  },
  embedAttachedVideo: (url, thumbnail_url, width, height) => {
    const videoFilename = url.split('/').pop();
    const thumbFilename = thumbnail_url.split('/').pop();
    const attachmentVideoUrl = `attachment://${videoFilename}`;
    const attachmentThumbUrl = `attachment://${thumbFilename}`;

    return {
      type: 'video',
      inlineMedia: true,
      url: url,
      proxy_url: url,
      thumbnail: {
        url: attachmentThumbUrl,
        proxy_url: thumbnail_url,
        width: width,
        height: height,
      },
      video: {
        url: attachmentVideoUrl,
        proxy_url: url,
        width: width,
        height: height,
      },
    };
  },
  embedYouTube: async (url) => {
    try {
      const videoId = new URL(url).searchParams["q"] ?? new URL(url).pathname.slice(1);
      const info = await innertube.getBasicInfo(videoId);
      const basicInfo = info.basic_info;
      const thumbnails = basicInfo.thumbnail;

      const validThumbnails = thumbnails.filter(
        (thumbnail) => thumbnail.width && thumbnail.height && thumbnail.width <= 800 && thumbnail.height <= 800,
      );

      const largestThumbnail = validThumbnails.reduce((largest, current) => {
        const largestSize = largest.width * largest.height;
        const currentSize = current.width * current.height;
        return currentSize > largestSize ? current : largest;
      }, validThumbnails[0]);

      const thumbnailUrl = largestThumbnail.url;
      const thumbnailWidth = largestThumbnail.width;
      const thumbnailHeight = largestThumbnail.height;
      const uploader = basicInfo.channel.name;
      const channelUrl = basicInfo.channel.url;

      return {
        type: 'video',
        inlineMedia: true,
        url: url,
        description: basicInfo.short_description,
        title: basicInfo.title,
        color: 16711680,
        thumbnail: {
          proxy_url: `/proxy/${encodeURIComponent(thumbnailUrl)}`,
          url: thumbnailUrl,
          width: thumbnailWidth,
          height: thumbnailHeight,
        },
        video: {
          url: basicInfo.embed.iframe_url,
          width: basicInfo.embed.width,
          height: basicInfo.embed.height,
          flags: 0
        },
        author: {
          name: uploader,
          url: channelUrl,
        },
        provider: {
          name: 'YouTube',
          url: 'https://youtube.com',
        },
      };
    } catch (error) {
      logText(error, 'error');

      return {}; //Return {} if ytdl core thinks you're a bot so it doesn't break messaging.
    }
  },
  generateMsgEmbeds: async (content, attachments, force) => {
    const ret = [];

    if (attachments && Array.isArray(attachments)) {
      for (const attachment of attachments) {
        const isVideo = attachment.name.endsWith('.mp4') || attachment.name.endsWith('.webm');

        if (isVideo && attachment.thumbnail_url) {
          ret.push(
            embedder.embedAttachedVideo(
              attachment.url,
              attachment.thumbnail_url,
              attachment.width,
              attachment.height,
            ),
          );
        }
      }
    }

    if (!global.config.auto_embed_urls) {
      return ret;
    }

    const urls = content.match(/https?:\/\/[^\s]+/g);

    if (urls == null || urls.length > 5 || urls.length == 0) {
      return ret;
    }

    for (var url of urls) {
      const checkCache = embedder.embed_cache.find((x) => x.url == url);

      if (checkCache && !force) {
        ret.push(checkCache.embed);

        continue;
      }

      let embed = {};

      if (url.includes('youtube.com/watch?v=') || url.includes('youtu.be/')) {
        embed = await embedder.embedYouTube(url);
      }

      if (
        (global.config.custom_invite_url != '' && url.includes(global.config.custom_invite_url)) ||
        url.includes('/invite/') ||
        url.includes('/gifts/')
      ) {
        continue;
      }

      if (!embed.title) {
        const urlObj = new URL(url);

        // urlObj.search = '';
        // Query string should not be removed, many websites use it to differentiate between pages.
        // For example, forums use showthread.php?p=... for threads, which should be embedded individually.

        urlObj.hash = '';

        url = urlObj.toString(); // im lazy ok

        var result;

        if (!url.startsWith('https://klipy.com')) {
          result = await embedder.getEmbedInfo(url);

          if (result == null) {
            continue;
          }

          embed = {
            type: 'rich',
            url: url,
            color: result.color,
            description: result.description,
            title: result.title,
          };
        }

        if (url.startsWith('https://klipy.com/gifs/')) {
          var slug = urlObj.pathname.split("/gifs/")[1]; // TODO: This can probaby be done better
          var apiUrl = `https://api.klipy.com/api/v1/${global.config.klipy_api_key}/gifs/${slug}`;

          result = await fetch(apiUrl, {
            headers: {
              'User-Agent': 'Bot: Mozilla/5.0 (compatible; Oldcordbot/2.0; +https://oldcordapp.com)',
            },
          }).then(r => r.json());

          embed.type = 'gifv';
          embed.url = url;

          embed.provider = {
            name: 'Klipy',
            url: 'https://klipy.com'
          };

          var thumb = result.data.file.sm.jpg;
          embed.thumbnail = {
            proxy_url: `/proxy/${encodeURIComponent(thumb.url)}`,
            url: thumb.url,
            width: thumb.width,
            height: thumb.height
          };

          var video = result.data.file.hd.mp4;
          embed.video = {
            url: video.url,
            proxy_url: encodeURIComponent(video.url),
            width: video.width,
            height: video.height
          };
        } else if (url.startsWith('https://tenor.com')) {
          embed.type = 'gifv';
          embed.provider = {
            name: 'Tenor',
            url: 'https://tenor.com',
          };

          if (result.image) {
            embed.thumbnail = {
             proxy_url: `/proxy/${encodeURIComponent(result.image.url)}`,
              url: result.image.url,
              width: result.image.width,
              height: result.image.height,
            };

            if (result.video) {
              embed.video = {
                url: result.video.url,
                proxy_url: encodeURIComponent(result.video.url),
                width: result.video.width,
                height: result.video.height,
              };
            }
          }

          delete embed.title;
          delete embed.description;
        } else if (url.endsWith('.gif')) {
          embed = {
            type: 'gifv',
            url: url,
            thumbnail: {
              proxy_url: `/proxy/${encodeURIComponent(url)}`,
              url: url,
              width: result.image?.width ?? 400,
              height: result.image?.height ?? 400,
            },
            video: {
              url: url,
              proxy_url: encodeURIComponent(url),
              width: result.image?.width ?? 400,
              height: result.image?.height ?? 400,
            },
          };

          delete embed.title;
          delete embed.description;
        } else {
          embed.type = 'rich';
          embed.image =
            result.image != null
              ? {
                proxy_url: `/proxy/${encodeURIComponent(result.image.url)}`,
                url: result.image.url,
                width: result.image.width > 1280 ? 1280 : result.image.width,
                height: result.image.height > 720 ? 720 : result.image.height,
              }
              : null;
        }
      } // TODO: This is a hot mess

      ret.push(embed);

      embedder.embed_cache.push({
        url: url,
        embed: embed,
      });
    }

    return ret;
  },
};

export const { embed_cache, getEmbedInfo, embedAttachedVideo, embedYouTube, generateMsgEmbeds } =
  embedder;

export default embedder;
