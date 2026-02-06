import { prisma } from '../prisma.ts';
import { handleMembersSync } from './lazyRequest.js';
import { logText } from './logger.ts';

const dispatcher = {
  dispatchEventTo: async (user_id: string, type: string, payload: any): Promise<boolean> => {
    const sessions = global.userSessions.get(user_id);

    if (!sessions || sessions.size === 0) return false;

    for (let z = 0; z < sessions.length; z++) {
      sessions[z].dispatch(type, payload);
    }

    return true;
  },
  dispatchLogoutTo: async (user_id: string): Promise<boolean> => {
    const sessions = global.userSessions.get(user_id);

    if (!sessions || sessions.size === 0) return false;

    for (let z = 0; z < sessions.length; z++) {
      sessions[z].socket.close(4004, 'Authentication failed');
      sessions[z].onClose(4004);
    }

    return true;
  },
  dispatchEventToEveryoneWhatAreYouDoingWhyWouldYouDoThis: async (type: string, payload: any) => {
    global.userSessions.forEach((sessions: any, _userId: string) => {
      for (let z = 0; z < sessions.length; z++) {
        sessions[z].dispatch(type, payload);
      }
    });
  },
  dispatchGuildMemberUpdateToAllTheirGuilds: async (user_id: string, new_user: any): Promise<boolean> => {
    const sessions = global.userSessions.get(user_id);

    if (!sessions || sessions.size === 0) return false;

    for (let z = 0; z < sessions.length; z++) {
      sessions[z].user = new_user;

      sessions[z].dispatchSelfUpdate();
    }

    return true;
  },
  dispatchEventToAllPerms: async (guild_id: string, channel_id: string, permission_check: any, type: string, payload: any): Promise<boolean> => {
    const guilds = await prisma.guild.findMany({
      where: {
        id: guild_id
      },
      include: {
        channels: true,
        members: true
      }
    });

    if (guilds.length == 0) return false;

    let guild = guilds[0];
    let channel;

    if (channel_id) {
      channel = guild.channels.find((x) => x.id === channel_id);

      if (!channel) return false;
    }

    const members = guild.members;

    if (members.length == 0) return false;

    for (let i = 0; i < members.length; i++) {
      const member = members[i];

      const uSessions = global.userSessions.get(member.user_id);

      if (!uSessions) continue;

      for (let z = 0; z < uSessions.length; z++) {
        const uSession = uSessions[z];

        if (guild.owner_id != member.user_id && uSession && uSession.socket) {
          //Skip checks if owner
          const guildPermCheck = global.permissions.hasGuildPermissionTo(
            guild,
            member.user_id,
            permission_check,
            uSession.socket.client_build,
          );

          if (!guildPermCheck) break; //No access to guild

          if (channel) {
            const channelPermCheck = global.permissions.hasChannelPermissionTo(
              channel,
              guild,
              member.user_id,
              permission_check,
            );

            if (!channelPermCheck) {
              break; //No access to channel
            }
          }
        }

        //Success
        uSession.dispatch(type, payload);
      }
    }

    logText(`(Event to all perms) -> ${type}`, 'dispatcher');

    return true;
  },
  //this system is so weird but hey it works - definitely due for a rewrite
  dispatchEventInGuildToThoseSubscribedTo: async (
    guild: any,
    type: string,
    payload: any,
    ignorePayload = false,
    typeOverride: any = null,
  ): Promise<boolean> => {
    if (!guild?.id) return false;

    const activeSessions = Array.from(global.userSessions.values()).flat();
    const updatePromises = activeSessions.map(async (session: any) => {
      const guildInSession = session.guilds?.find((g) => g.id === guild.id);
      if (!guildInSession) return;

      const socket = session.socket;
      let finalPayload = payload;
      let finalType = typeOverride || type;

      if (typeof payload === 'function') {
        try {
          finalPayload = await payload.call(session);

          if (!finalPayload) return;

          if (finalPayload.ops) {
            finalType = 'GUILD_MEMBER_LIST_UPDATE';
          }
        } catch (err: any) {
          console.error(err);
          console.log(err.stackTrace);
          logText(`Error executing dynamic payload: ${err}`, 'error');
          return;
        }
      } else if (type === 'PRESENCE_UPDATE' && payload && payload.user) {
        finalPayload = { ...payload };

        const member = guild.members.find((m) => m.user.id === finalPayload.user.id);

        if (member) {
          finalPayload.nick = member.nick;
          finalPayload.roles = member.roles;
        }

        const isLegacy =
          socket &&
          (socket.client_build_date.getFullYear() < 2016 ||
            (socket.client_build_date.getFullYear() === 2016 &&
              socket.client_build_date.getMonth() < 8));

        const current_status = finalPayload.status.toLowerCase();

        if (isLegacy) {
          if (['offline', 'invisible'].includes(current_status)) {
            finalPayload.status = 'offline';
          } else if (current_status === 'dnd') {
            finalPayload.status = 'online';
          }
        }
      }

      const sub = session.subscriptions?.[guild.id];

      if (sub) {
        const channel = guild.channels.find((x) => x.id === sub.channel_id);

        if (channel) {
          await handleMembersSync(session, channel, guild, sub);
        }
      }

      if (!ignorePayload) {
        session.dispatch(finalType, finalPayload);
      }
    });

    await Promise.all(updatePromises);

    logText(`(Subscription event in ${guild.id}) -> ${type}`, 'dispatcher');

    return true;
  },
  getSessionsInGuild: (guild) => {
    const sessions: any = [];

    if (!guild || !guild.members) {
      return [];
    }

    for (let i = 0; i < guild.members.length; i++) {
      const member = guild.members[i];

      if (!member) continue;

      const uSessions: any = global.userSessions.get(member.id);

      if (!uSessions || uSessions.length === 0) continue;

      sessions.push(...uSessions);
    }

    return sessions;
  },
  getAllActiveSessions: () => {
    const usessions: any = [];

    global.userSessions.forEach((sessions: any, _userId: string) => {
      for (let z = 0; z < sessions.length; z++) {
        if (sessions[z].dead || sessions[z].terminated) continue;

        usessions.push(sessions[z]);
      }
    });

    return usessions;
  },
  dispatchEventInGuild: async (guild: any, type: string, payload: any): Promise<boolean> => {
    if (!guild || !guild.members) {
      return false;
    }

    for (let i = 0; i < guild.members.length; i++) {
      const member = guild.members[i];

      if (!member) continue;

      const uSessions = global.userSessions.get(member.user_id);

      if (!uSessions || uSessions.length === 0) continue;

      for (let z = 0; z < uSessions.length; z++) {
        const session = uSessions[z];
        const socket = session.socket;
        const finalPayload = typeof payload === 'function' ? payload : { ...payload };
        const isLegacyClient =
          (socket && socket.client_build_date.getFullYear() === 2015) ||
          (socket &&
            socket.client_build_date.getFullYear() === 2016 &&
            socket.client_build_date.getMonth() < 8) ||
          (socket &&
            socket.client_build_date.getFullYear() === 2016 &&
            socket.client_build_date.getMonth() === 8 &&
            socket.client_build_date.getDate() < 26);

        if (type == 'PRESENCE_UPDATE' && isLegacyClient) {
          const current_status = payload.status.toLowerCase();

          if (['offline', 'invisible'].includes(current_status)) {
            finalPayload.status = 'offline';
          } else if (current_status === 'dnd') {
            finalPayload.status = 'online';
          }
        }

        session.dispatch(type, finalPayload);
      }
    }

    logText(`(Event in guild) -> ${type}`, 'dispatcher');

    return true;
  },
  dispatchEventInPrivateChannel: async (channel: any, type: string, payload: any): Promise<boolean> => {
    if (channel === null || !channel.recipients) return false;

    for (let i = 0; i < channel.recipients.length; i++) {
      const recipient = channel.recipients[i].id;

      const uSessions = global.userSessions.get(recipient);

      if (!uSessions || uSessions.length === 0) continue;

      for (let z = 0; z < uSessions.length; z++) {
        uSessions[z].dispatch(type, payload);
      }
    }

    logText(`(Event in group/dm channel) -> ${type}`, 'dispatcher');

    return true;
  },
  dispatchEventInChannel: async (guild: any, channel_id: string, type: string, payload: any): Promise<boolean> => {
    if (guild === null) return false;

    const channel = guild.channels.find((x) => x.id === channel_id);

    if (channel == null) return false;

    for (let i = 0; i < guild.members.length; i++) {
      const member = guild.members[i];

      if (!member) continue;

      const permissions = global.permissions.hasChannelPermissionTo(
        channel,
        guild,
        member.id,
        'READ_MESSAGES',
      );

      if (!permissions) continue;

      const uSessions = global.userSessions.get(member.id);

      if (!uSessions || uSessions.length === 0) continue;

      for (let z = 0; z < uSessions.length; z++) {
        uSessions[z].dispatch(type, payload);
      }
    }

    logText(`(Event in channel) -> ${type}`, 'dispatcher');

    return true;
  },
};

export const {
  dispatchEventTo,
  dispatchLogoutTo,
  dispatchEventToEveryoneWhatAreYouDoingWhyWouldYouDoThis,
  dispatchGuildMemberUpdateToAllTheirGuilds,
  dispatchEventToAllPerms,
  dispatchEventInGuildToThoseSubscribedTo,
  getSessionsInGuild,
  getAllActiveSessions,
  dispatchEventInGuild,
  dispatchEventInPrivateChannel,
  dispatchEventInChannel,
} = dispatcher;

export default dispatcher;
