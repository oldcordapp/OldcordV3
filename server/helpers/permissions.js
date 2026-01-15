import { logText } from './logger';

const permissions = {
  CREATE_INSTANT_INVITE: 1 << 0,
  KICK_MEMBERS: 1 << 1,
  BAN_MEMBERS: 1 << 2,
  ADMINISTRATOR: 1 << 3,
  MANAGE_CHANNELS: 1 << 4,
  MANAGE_GUILD: 1 << 5,
  CHANGE_NICKNAME: 1 << 26,
  MANAGE_NICKNAMES: 1 << 27,
  MANAGE_ROLES: 1 << 28,
  MANAGE_WEBHOOKS: 1 << 29,
  MANAGE_EMOJIS: 1 << 30,
  READ_MESSAGES: 1 << 10,
  SEND_MESSAGES: 1 << 11,
  SEND_TTS_MESSAGES: 1 << 12,
  MANAGE_MESSAGES: 1 << 13,
  EMBED_LINKS: 1 << 14,
  ATTACH_FILES: 1 << 15,
  READ_MESSAGE_HISTORY: 1 << 16,
  MENTION_EVERYONE: 1 << 17,
  USE_EXTERNAL_EMOJIS: 1 << 18,
  ADD_REACTIONS: 1 << 6,
  CONNECT: 1 << 20,
  SPEAK: 1 << 21,
  MUTE_MEMBERS: 1 << 22,
  DEAFEN_MEMBERS: 1 << 23,
  MOVE_MEMBERS: 1 << 24,
  USE_VAD: 1 << 25,
  has(compare, key) {
    try {
      let bitmask = this[key];

      if (!bitmask) return false;

      return (BigInt(compare) & BigInt(bitmask)) === BigInt(bitmask);
    } catch (e) {
      return false;
    }
  },
  hasGuildPermissionTo(guild, user_id, key, for_build) {
    try {
      if (!guild) return false;

      let member = guild.members.find((y) => y.id == user_id);

      if (!member) return false;

      if (guild.owner_id == member.user.id) return true;

      let everyoneRole = guild.roles.find((x) => x.id === guild.id);
      let totalPermissions = BigInt(everyoneRole ? everyoneRole.permissions : 0);

      for (let roleId of member.roles) {
        let role = guild.roles.find((x) => x.id === roleId);

        if (role) {
          totalPermissions |= BigInt(role.permissions);
        }
      }

      let ADMINISTRATOR = BigInt(8);

      if ((totalPermissions & ADMINISTRATOR) === ADMINISTRATOR) {
        return true;
      }

      let permissionBit = BigInt(this.toObject()[key]);

      return (totalPermissions & permissionBit) === permissionBit;
    } catch (error) {
      logText(error, 'error');
      return false;
    }
  },
  hasChannelPermissionTo(channel, guild, user_id, key) {
    try {
      if (!channel || !guild) return false;
      if (guild.owner_id == user_id) return true;

      let member = guild.members.find((y) => y.id == user_id);

      if (!member) return false;

      let everyoneRole = guild.roles.find((r) => r.id === guild.id);
      let permissions = BigInt(everyoneRole ? everyoneRole.permissions : 0);

      let memberRoles = [];

      for (let roleId of member.roles) {
        let role = guild.roles.find((r) => r.id === roleId);

        if (role) {
          memberRoles.push(role);
          permissions |= BigInt(role.permissions);
        }
      }

      let ADMIN_BIT = BigInt(8);

      if ((permissions & ADMIN_BIT) === ADMIN_BIT) return true;

      if (channel.permission_overwrites && channel.permission_overwrites.length > 0) {
        let overwrites = channel.permission_overwrites;
        let everyoneOverwrite = overwrites.find((o) => o.id === guild.id);

        if (everyoneOverwrite) {
          permissions &= ~BigInt(everyoneOverwrite.deny);
          permissions |= BigInt(everyoneOverwrite.allow);
        }

        let roleAllow = BigInt(0);
        let roleDeny = BigInt(0);

        for (let role of memberRoles) {
          let overwrite = overwrites.find((o) => o.id === role.id);

          if (overwrite) {
            roleAllow |= BigInt(overwrite.allow);
            roleDeny |= BigInt(overwrite.deny);
          }
        }

        permissions &= ~roleDeny;
        permissions |= roleAllow;

        let memberOverwrite = overwrites.find((o) => o.id === member.id);

        if (memberOverwrite) {
          permissions &= ~BigInt(memberOverwrite.deny);
          permissions |= BigInt(memberOverwrite.allow);
        }
      }

      if ((permissions & ADMIN_BIT) === ADMIN_BIT) return true;

      let bitmask = BigInt(this.toObject()[key]);

      return (permissions & bitmask) === bitmask;
    } catch (error) {
      logText(error, 'error');

      return false;
    }
  },
  toObject() {
    return {
      CREATE_INSTANT_INVITE: 1 << 0,
      KICK_MEMBERS: 1 << 1,
      BAN_MEMBERS: 1 << 2,
      ADMINISTRATOR: 1 << 3,
      MANAGE_CHANNELS: 1 << 4,
      MANAGE_GUILD: 1 << 5,
      CHANGE_NICKNAME: 1 << 26,
      MANAGE_NICKNAMES: 1 << 27,
      MANAGE_ROLES: 1 << 28,
      MANAGE_WEBHOOKS: 1 << 29,
      MANAGE_EMOJIS: 1 << 30,
      READ_MESSAGES: 1 << 10,
      SEND_MESSAGES: 1 << 11,
      SEND_TTS_MESSAGES: 1 << 12,
      MANAGE_MESSAGES: 1 << 13,
      EMBED_LINKS: 1 << 14,
      ATTACH_FILES: 1 << 15,
      READ_MESSAGE_HISTORY: 1 << 16,
      MENTION_EVERYONE: 1 << 17,
      USE_EXTERNAL_EMOJIS: 1 << 18,
      ADD_REACTIONS: 1 << 6,
      CONNECT: 1 << 20,
      SPEAK: 1 << 21,
      MUTE_MEMBERS: 1 << 22,
      DEAFEN_MEMBERS: 1 << 23,
      MOVE_MEMBERS: 1 << 24,
      USE_VAD: 1 << 25,
    };
  },
};

export default permissions;
