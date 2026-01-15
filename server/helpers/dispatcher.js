import { logText } from './logger';
import { handleMembersSync } from './lazyRequest';

const dispatcher = {
  dispatchEventTo: async (user_id, type, payload) => {
    let sessions = global.userSessions.get(user_id);

    if (!sessions || sessions.size === 0) return false;

    for (let z = 0; z < sessions.length; z++) {
      sessions[z].dispatch(type, payload);
    }
  },
  dispatchLogoutTo: async (user_id) => {
    let sessions = global.userSessions.get(user_id);

    if (!sessions || sessions.size === 0) return false;

    for (let z = 0; z < sessions.length; z++) {
      sessions[z].socket.close(4004, 'Authentication failed');
      sessions[z].onClose(4004);
    }
  },
  dispatchEventToEveryoneWhatAreYouDoingWhyWouldYouDoThis: async (type, payload) => {
    global.userSessions.forEach((sessions, userId) => {
      for (let z = 0; z < sessions.length; z++) {
        sessions[z].dispatch(type, payload);
      }
    });
  },
  dispatchGuildMemberUpdateToAllTheirGuilds: async (user_id, new_user) => {
    let sessions = global.userSessions.get(user_id);

    if (!sessions || sessions.size === 0) return false;

    for (let z = 0; z < sessions.length; z++) {
      sessions[z].user = new_user;

      sessions[z].dispatchSelfUpdate();
    }
  },
  dispatchEventToAllPerms: async (guild_id, channel_id, permission_check, type, payload) => {
    const guild = await global.database.getGuildById(guild_id);

    if (guild == null) return false;

    let channel;

    if (channel_id) {
      channel = guild.channels.find((x) => x.id === channel_id);

      if (!channel) return false;
    }

    const members = guild.members;

    if (members.length == 0) return false;

    for (let i = 0; i < members.length; i++) {
      let member = members[i];

      let uSessions = global.userSessions.get(member.id);

      if (!uSessions) continue;

      for (let z = 0; z < uSessions.length; z++) {
        let uSession = uSessions[z];

        if (guild.owner_id != member.id && uSession && uSession.socket) {
          //Skip checks if owner
          let guildPermCheck = global.permissions.hasGuildPermissionTo(
            guild,
            member.id,
            permission_check,
            uSession.socket.client_build,
          );

          if (!guildPermCheck) break; //No access to guild

          if (channel) {
            const channelPermCheck = global.permissions.hasChannelPermissionTo(
              channel,
              guild,
              member.id,
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
    guild,
    type,
    payload,
    ignorePayload = false,
    typeOverride = null,
  ) => {
    if (!guild?.id) return;

    let activeSessions = Array.from(global.userSessions.values()).flat();
    let updatePromises = activeSessions.map(async (session) => {
      let guildInSession = session.guilds?.find((g) => g.id === guild.id);
      if (!guildInSession) return;

      let socket = session.socket;
      let finalPayload = payload;
      let finalType = typeOverride || type;

      if (typeof payload === 'function') {
        try {
          finalPayload = await payload.call(session);

          if (!finalPayload) return;

          if (finalPayload.ops) {
            finalType = 'GUILD_MEMBER_LIST_UPDATE';
          }
        } catch (err) {
          logText(`Error executing dynamic payload: ${err}`, 'error');
          return;
        }
      } else if (type === 'PRESENCE_UPDATE' && payload && payload.user) {
        finalPayload = { ...payload };

        let member = guild.members.find((m) => m.user.id === finalPayload.user.id);

        if (member) {
          finalPayload.nick = member.nick;
          finalPayload.roles = member.roles;
        }

        let isLegacy =
          socket &&
          (socket.client_build_date.getFullYear() < 2016 ||
            (socket.client_build_date.getFullYear() === 2016 &&
              socket.client_build_date.getMonth() < 8));

        let current_status = finalPayload.status.toLowerCase();

        if (isLegacy) {
          if (['offline', 'invisible'].includes(current_status)) {
            finalPayload.status = 'offline';
          } else if (current_status === 'dnd') {
            finalPayload.status = 'online';
          }
        }
      }

      let sub = session.subscriptions?.[guild.id];

      if (sub) {
        let channel = guild.channels.find((x) => x.id === sub.channel_id);

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
    let sessions = [];

    if (!guild || !guild.members) {
      return [];
    }

    for (let i = 0; i < guild.members.length; i++) {
      let member = guild.members[i];

      if (!member) continue;

      let uSessions = global.userSessions.get(member.id);

      if (!uSessions || uSessions.length === 0) continue;

      sessions.push(...uSessions);
    }

    return sessions;
  },
  getAllActiveSessions: () => {
    let usessions = [];

    global.userSessions.forEach((sessions, userId) => {
      for (let z = 0; z < sessions.length; z++) {
        if (sessions[z].dead || sessions[z].terminated) continue;

        usessions.push(sessions[z]);
      }
    });

    return usessions;
  },
  dispatchEventInGuild: async (guild, type, payload) => {
    if (!guild || !guild.members) {
      return;
    }

    for (let i = 0; i < guild.members.length; i++) {
      let member = guild.members[i];

      if (!member) continue;

      let uSessions = global.userSessions.get(member.user.id);

      if (!uSessions || uSessions.length === 0) continue;

      for (let z = 0; z < uSessions.length; z++) {
        let session = uSessions[z];
        let socket = session.socket;
        let finalPayload = typeof payload === 'function' ? payload : { ...payload };
        let isLegacyClient =
          (socket && socket.client_build_date.getFullYear() === 2015) ||
          (socket &&
            socket.client_build_date.getFullYear() === 2016 &&
            socket.client_build_date.getMonth() < 8) ||
          (socket &&
            socket.client_build_date.getFullYear() === 2016 &&
            socket.client_build_date.getMonth() === 8 &&
            socket.client_build_date.getDate() < 26);

        if (type == 'PRESENCE_UPDATE' && isLegacyClient) {
          let current_status = payload.status.toLowerCase();

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
  dispatchEventInPrivateChannel: async (channel, type, payload) => {
    if (channel === null || !channel.recipients) return false;

    for (let i = 0; i < channel.recipients.length; i++) {
      let recipient = channel.recipients[i].id;

      let uSessions = global.userSessions.get(recipient);

      if (!uSessions || uSessions.length === 0) continue;

      for (let z = 0; z < uSessions.length; z++) {
        uSessions[z].dispatch(type, payload);
      }
    }

    logText(`(Event in group/dm channel) -> ${type}`, 'dispatcher');

    return true;
  },
  dispatchEventInChannel: async (guild, channel_id, type, payload) => {
    if (guild === null) return false;

    const channel = guild.channels.find((x) => x.id === channel_id);

    if (channel == null) return false;

    for (let i = 0; i < guild.members.length; i++) {
      let member = guild.members[i];

      if (!member) continue;

      let permissions = global.permissions.hasChannelPermissionTo(
        channel,
        guild,
        member.id,
        'READ_MESSAGES',
      );

      if (!permissions) continue;

      let uSessions = global.userSessions.get(member.id);

      if (!uSessions || uSessions.length === 0) continue;

      for (let z = 0; z < uSessions.length; z++) {
        uSessions[z].dispatch(type, payload);
      }
    }

    logText(`(Event in channel) -> ${type}`, 'dispatcher');

    return true;
  },
};

export default dispatcher;
