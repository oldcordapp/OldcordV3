import "dotenv/config";
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from "./generated/prisma/client/client.ts";

const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })

export const prisma = new PrismaClient({ adapter }).$extends({
  result: {
    user: {
      toPublic: {
        needs: { id: true, username: true, discriminator: true, avatar: true, bot: true, flags: true },
        compute(user) {
          return () => ({
            id: user.id,
            username: user.username,
            discriminator: user.discriminator,
            avatar: user.avatar,
            bot: user.bot,
            public_flags: user.flags,
          });
        },
      },
    },
    guild: {
      toPublic: {
        needs: { 
          id: true, name: true, icon: true, banner: true, owner_id: true, 
          features: true, custom_emojis: true, premium_tier: true, 
          premium_subscription_count: true, vanity_url: true,
          region: true,
          verification_level: true,
          default_message_notifications: true,
          explicit_content_filter: true
        },
        compute(guild) {
          return () => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon,
            banner: guild.banner,
            owner_id: guild.owner_id,
            features: guild.features || [],
            emojis: guild.custom_emojis || [],
            premium_tier: guild.premium_tier || 0,
            premium_subscription_count: guild.premium_subscription_count || 0,
            vanity_url_code: guild.vanity_url,
            region: guild.region,
            verification_level: guild.verification_level,
            default_message_notifications: guild.default_message_notifications,
            explicit_content_filter: guild.explicit_content_filter,
          });
        },
      },
    },
    channel: {
      toPublic: {
        needs: { id: true, name: true, type: true, guild_id: true, topic: true, position: true, last_message_id: true, nsfw: true, permission_overwrites: true },
        compute(channel) {
          return () => ({
            id: channel.id,
            name: channel.name,
            type: channel.type,
            guild_id: channel.guild_id,
            position: channel.position,
            topic: channel.topic,
            last_message_id: channel.last_message_id,
            nsfw: channel.nsfw,
            permission_overwrites: channel.permission_overwrites,
          });
        },
      },
    }
  }
});