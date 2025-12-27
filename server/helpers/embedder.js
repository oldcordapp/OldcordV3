const ytdl = require('@distube/ytdl-core');
const { logText } = require('./logger');
const globalUtils = require('./globalutils');
const cheerio = require('cheerio');
const { Jimp } = require('jimp');
const path = require('fs');

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
            let content = await fetch(url, {
                headers: {
                    'User-Agent': 'Bot: Mozilla/5.0 (compatible; Oldcordbot/2.0; +https://oldcordapp.com)'
                }
            })

            if (!content.ok) {
                return null;
            }

            let fetch2;
            let image_buffer;
            let image_data;

            if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg")) {
                image_buffer = await content.arrayBuffer();
                image_data = await Jimp.read(image_buffer);

                return {
                    color: 7506394,
                    title: "",
                    description: "",
                    image: {
                        url: url,
                        width: image_data.bitmap.width ?? 400,
                        height: image_data.bitmap.height ?? 400
                    }
                }
            }

            let text = await content.text();
            let $ = cheerio.load(text);
            let description = $('meta[name="description"]').attr('content');
            let themeColor = $('meta[name="theme-color"]').attr('content');
            let ogTitle = $('meta[property="og:title"]').attr('content');
            let ogImage = $('meta[property="og:image"]').attr('content');
            let twitterImage = $('meta[property="twitter:image"]').attr('content');

            if (!ogImage && twitterImage) {
                ogImage = twitterImage;
            }

            let should_embed = !!(description || themeColor || ogTitle || ogImage);

            if (!should_embed) {
                return null;
            }

            let color = themeColor ? hexToDecimal(themeColor) : 7506394;
            let title = ogTitle || $('title').text() || "";

            let embedObj = {
                color: color,
                title: title,
                description: description
            }

            if (ogImage) {
                let full_img = new URL(ogImage, url).href;

                fetch2 = await fetch(full_img, {
                    headers: {
                        'User-Agent': 'Bot: Mozilla/5.0 (compatible; Oldcordbot/2.0; +https://oldcordapp.com)'
                    }
                });

                if (fetch2.ok) {
                    image_buffer = await fetch2.arrayBuffer();

                    try {
                        image_data = await Jimp.read(image_buffer);
                    } catch (err) {
                        logText(`Jimp failed to read image to calculate dimensions for getEmbedInfo: ${ogImage}: ${err}`, "error");

                        image_data = null;
                    }
                } else {
                    image_data = null;
                }
            }

            if (ogImage && image_data) {
                let full_img = new URL(ogImage, url).href;

                embedObj.image = {
                    url: full_img,
                    width: image_data.bitmap.width ?? 400,
                    height: image_data.bitmap.height ?? 400
                };
            }

            return should_embed ? embedObj : null;
        } catch (error) {
            logText(error, "error");

            return null;
        }
    },
    embedAttachedVideo: (url, thumbnail_url, width, height) => {
        let videoFilename = url.split('/').pop();
        let thumbFilename = thumbnail_url.split('/').pop();
        let attachmentVideoUrl = `attachment://${videoFilename}`;
        let attachmentThumbUrl = `attachment://${thumbFilename}`;

        return {
            type: "video",
            inlineMedia: true,
            url: url,
            proxy_url: url,
            thumbnail: {
                url: attachmentThumbUrl,
                proxy_url: thumbnail_url,
                width: width,
                height: height
            },
            video: {
                url: attachmentVideoUrl,
                proxy_url: url,
                width: width,
                height: height
            },
        }
    },
    embedYouTube: async (url) => {
        try {
            const info = await ytdl.getInfo(url);
            const videoDetails = info.videoDetails;

            const thumbnails = videoDetails.thumbnails;

            const validThumbnails = thumbnails.filter(thumbnail =>
                thumbnail.width < 800 && thumbnail.height < 800
            );

            const largestThumbnail = validThumbnails.reduce((largest, current) => {
                const largestSize = largest.width * largest.height;
                const currentSize = current.width * current.height;
                return currentSize > largestSize ? current : largest;
            }, validThumbnails[0]);

            const thumbnailUrl = largestThumbnail.url;
            const thumbnailWidth = largestThumbnail.width;
            const thumbnailHeight = largestThumbnail.height;
            const uploader = videoDetails.author.name;
            const channelUrl = videoDetails.author.channel_url

            return {
                type: "video",
                inlineMedia: true,
                url: url,
                description: videoDetails.description,
                title: videoDetails.title,
                thumbnail: {
                    proxy_url: `/proxy/${encodeURIComponent(thumbnailUrl)}`,
                    url: thumbnailUrl,
                    width: thumbnailWidth,
                    height: thumbnailHeight
                },
                author: {
                    url: channelUrl,
                    name: uploader
                },
                provider: {
                    url: "https://youtube.com",
                    name: "YouTube"
                }
            };
        } catch (error) {
            logText(error, "error");    

            return {}; //Return {} if ytdl core thinks you're a bot so it doesn't break messaging.
        }
    },
    generateMsgEmbeds: async (content, attachments, force) => {
        let ret = [];

        if (attachments && Array.isArray(attachments)) {
            for (let attachment of attachments) {
                let isVideo = attachment.name.endsWith(".mp4") || attachment.name.endsWith(".webm");
                
                if (isVideo && attachment.thumbnail_url) {
                    ret.push(embedder.embedAttachedVideo(attachment.url, attachment.thumbnail_url, attachment.width, attachment.height));
                }
            }
        }

        if (!global.config.auto_embed_urls) {
            return ret;
        }

        let urls = content.match(/https?:\/\/[^\s]+/g);

        if (urls == null || urls.length > 5 || urls.length == 0) {
            return ret;
        }

        for (var url of urls) {
            let checkCache = embedder.embed_cache.find(x => x.url == url);

            if (checkCache && !force) {
                ret.push(checkCache.embed);

                continue;
            }

            let embed = {};

            if (url.includes("youtube.com/watch?v=") || url.includes("youtu.be/")) {
                embed = await embedder.embedYouTube(url);
            }

            if ((global.config.custom_invite_url != "" && url.includes(global.config.custom_invite_url)) || url.includes("/invite/") || url.includes("/gifts/")) {
                continue;
            }

            if (!embed.title) {
                let urlObj = new URL(url);

                urlObj.search = '';
                urlObj.hash = '';

                url = urlObj.toString(); //im lazy ok

                let result = await embedder.getEmbedInfo(url);

                if (result == null) {
                    continue;
                }

                embed = {
                    type: "rich",
                    url: url,
                    color: result.color,
                    description: result.description,
                    title: result.title
                }

                if (url.startsWith("https://tenor.com")) {
                    embed.thumbnail = result.image != null ? {
                        proxy_url: `/proxy/${encodeURIComponent(result.image.url)}`,
                        url: result.image.url,
                        width: (result.image.width > 800 ? 800 : result.image.width),
                        height: (result.image.height > 800 ? 800 : result.image.height)
                    } : null
                } else {
                    embed.image = result.image != null ? {
                        proxy_url: `/proxy/${encodeURIComponent(result.image.url)}`,
                        url: result.image.url,
                        width: (result.image.width > 800 ? 800 : result.image.width),
                        height: (result.image.height > 800 ? 800 : result.image.height)
                    } : null
                }
            }

            ret.push(embed);

            embedder.embed_cache.push({
                url: url,
                embed: embed
            });
        }

        return ret;
    }
};

module.exports = embedder;