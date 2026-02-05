import { logText } from './logger.ts';

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
  has(compare: string, key: string): boolean {
    try {
      const bitmask = this[key];

      if (!bitmask) return false;

      return (BigInt(compare) & BigInt(bitmask)) === BigInt(bitmask);
    } catch (e) {
      return false;
    }
  },
  hasGuildPermissionTo(guild: any, user_id: string, key:string, _for_build: string): boolean {
    try {
      if (!guild) return false;

      const member = guild.members.find((y) => y.id == user_id);

      if (!member) return false;

      if (guild.owner_id == member.user.id) return true;

      const everyoneRole = guild.roles.find((x) => x.id === guild.id);
      let totalPermissions = BigInt(everyoneRole ? everyoneRole.permissions : 0);

      for (const roleId of member.roles) {
        const role = guild.roles.find((x) => x.id === roleId);

        if (role) {
          totalPermissions |= BigInt(role.permissions);
        }
      }

      const ADMINISTRATOR = BigInt(8);

      if ((totalPermissions & ADMINISTRATOR) === ADMINISTRATOR) {
        return true;
      }

      const permissionBit = BigInt(this.toObject()[key]);

      return (totalPermissions & permissionBit) === permissionBit;
    } catch (error) {
      logText(error, 'error');
      return false;
    }
  },
  hasChannelPermissionTo(channel: any, guild: any, user_id: string, key: string): boolean {
    try {
      if (!channel || !guild) return false;
      if (guild.owner_id == user_id) return true;

      const member = guild.members.find((y) => y.id == user_id);

      if (!member) return false;

      const everyoneRole = guild.roles.find((r) => r.id === guild.id);
      let permissions = BigInt(everyoneRole ? everyoneRole.permissions : 0);

      const memberRoles: any = [];

      for (const roleId of member.roles) {
        const role: any = guild.roles.find((r) => r.id === roleId);

        if (role) {
          memberRoles.push(role);
          permissions |= BigInt(role.permissions);
        }
      }

      const ADMIN_BIT = BigInt(8);

      if ((permissions & ADMIN_BIT) === ADMIN_BIT) return true;

      if (channel.permission_overwrites && channel.permission_overwrites.length > 0) {
        const overwrites = channel.permission_overwrites;
        const everyoneOverwrite = overwrites.find((o) => o.id === guild.id);

        if (everyoneOverwrite) {
          permissions &= ~BigInt(everyoneOverwrite.deny);
          permissions |= BigInt(everyoneOverwrite.allow);
        }

        let roleAllow = BigInt(0);
        let roleDeny = BigInt(0);

        for (const role of memberRoles as any[]) {
          const overwrite = overwrites.find((o) => o.id === role.id);

          if (overwrite) {
            roleAllow |= BigInt(overwrite.allow);
            roleDeny |= BigInt(overwrite.deny);
          }
        }

        permissions &= ~roleDeny;
        permissions |= roleAllow;

        const memberOverwrite = overwrites.find((o) => o.id === member.id);

        if (memberOverwrite) {
          permissions &= ~BigInt(memberOverwrite.deny);
          permissions |= BigInt(memberOverwrite.allow);
        }
      }

      if ((permissions & ADMIN_BIT) === ADMIN_BIT) return true;

      const bitmask = BigInt(this.toObject()[key]);

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
