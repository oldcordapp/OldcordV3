import dispatcher from '../helpers/dispatcher.js';
import globalUtils from '../helpers/globalutils.js';
import lazyRequest from '../helpers/lazyRequest.js';
import session from '../helpers/session.js';

const OPCODES = {
  HEARTBEAT: 1,
  IDENTIFY: 2,
  PRESENCE: 3,
  VOICESTATE: 4,
  RESUME: 6,
  INVALID_SESSION: 9,
  HEARTBEAT_INFO: 10,
  HEARTBEAT_ACK: 11,
  LAZYFETCH: 12,
  MEMBERCHUNKS: 14,
};

async function handleIdentify(socket, packet) {
  if (socket.identified || socket.session) {
    return socket.close(4005, 'You have already identified.');
  }

  global.gateway.debug('New client connection');

  socket.identified = true;

  const user = await global.database.getAccountByToken(packet.d.token);

  if (user == null || user.disabled_until) {
    return socket.close(4004, 'Authentication failed');
  }

  const providedIntents = packet.d.intents;

  global.gatewayIntentMap.delete(user.id);

  if (providedIntents !== undefined && providedIntents !== null) {
    global.gatewayIntentMap.set(user.id, Number(providedIntents));
  }

  let savedStatus = 'online';

  if (user.bot) {
    user.settings = {
      status: 'online',
    };
  } else {
    savedStatus = user.settings?.status || 'online';
  }

  socket.user = user;

  const sesh = new session(
    globalUtils.generateString(16),
    socket,
    user,
    packet.d.token,
    false,
    {
      game_id: null,
      status: savedStatus,
      activities: [],
      user: globalUtils.miniUserObject(socket.user),
      roles: [],
    },
    undefined,
    undefined,
    undefined,
    socket.apiVersion,
    packet.d.capabilities ?? socket.client_build_date,
  );

  socket.session = sesh;
  socket.session.start();

  await socket.session.prepareReady();

  const pastPresence = packet.d.presence;
  let finalStatus = savedStatus;

  if (pastPresence && pastPresence.status && pastPresence.status === savedStatus) {
    finalStatus = pastPresence.status;
  } //Only listening if the users settings status is the same as the identify payload - as thats what discord did

  await socket.session.updatePresence(finalStatus, null, false, true);
}

async function handleHeartbeat(socket, packet) {
  if (!socket.hb) return;

  socket.hb.reset();
  socket.hb.acknowledge(packet.d);
}

async function handlePresence(socket, packet) {
  if (!socket.session) return socket.close(4003, 'Not authenticated');

  await global.gateway.syncPresence(socket, packet);
}

async function handleVoiceState(socket, packet) {
  if (!socket.session) return socket.close(4003, 'Not authenticated');

  const guild_id = packet.d.guild_id;
  const channel_id = packet.d.channel_id;
  const self_mute = packet.d.self_mute;
  const self_deaf = packet.d.self_deaf;

  if (guild_id === null && channel_id === null) {
    if (socket.current_guild && socket.current_guild.id && socket.user && socket.user.id) {
      const voiceStates = global.guild_voice_states.get(socket.current_guild.id);

      voiceStates.splice(
        voiceStates.findIndex((x) => x.user_id === socket.user.id),
        1,
      );

      await dispatcher.dispatchEventInGuild(socket.current_guild, 'VOICE_STATE_UPDATE', {
        channel_id: channel_id,
        guild_id: socket.current_guild.id, //must be guild id even if they left the vc and they dont send any guild id
        user_id: socket.user.id,
        session_id: socket.session.id,
        deaf: false,
        mute: false,
        self_deaf: self_deaf,
        self_mute: self_mute,
        self_video: false,
        suppress: false,
      });

      socket.current_guild = null;
      socket.inCall = false;
      return;
    }
  }

  socket.session.guild_id = guild_id ?? 0;
  socket.session.channel_id = channel_id ?? 0;
  socket.session.self_muted = self_mute;
  socket.session.self_deafened = self_deaf;

  if (!socket.current_guild) {
    socket.current_guild = await global.database.getGuildById(guild_id);
  }

  if (socket.session.channel_id != 0 && socket.current_guild) {
    const channel = socket.current_guild.channels.find((x) => x.id === channel_id);

    if (!channel || channel.type != 2) {
      return;
    }

    if (channel && channel.type === 2 && channel.user_limit > 0) {
      const testRoom = global.rooms.filter((x) => x.room_id === `${guild_id}:${channel_id}`);
      const permissionCheck = global.permissions.hasChannelPermissionTo(
        channel,
        socket.current_guild,
        socket.user.id,
        'MOVE_MEMBERS',
      );

      if (testRoom && testRoom.length >= channel.user_limit && !permissionCheck) {
        return;
      } //to-do: work on moving members into the channel
    }
  }

  let room = global.rooms.find((x) => x.room_id === `${guild_id}:${channel_id}`);

  if (!room) {
    global.rooms.push({
      room_id: `${guild_id}:${channel_id}`,
      participants: [],
    });

    global.guild_voice_states.set(guild_id, []);

    room = global.rooms.find((x) => x.room_id === `${guild_id}:${channel_id}`);
  }

  await dispatcher.dispatchEventInGuild(socket.current_guild, 'VOICE_STATE_UPDATE', {
    channel_id: channel_id,
    guild_id: guild_id,
    user_id: socket.user.id,
    session_id: socket.session.id,
    deaf: false,
    mute: false,
    self_deaf: self_deaf,
    self_mute: self_mute,
    self_video: false,
    suppress: false,
  });

  if (!room.participants.find((x) => x.user.id === socket.user.id)) {
    room.participants.push({
      user: globalUtils.miniUserObject(socket.user),
      ssrc: globalUtils.generateString(30),
    });

    const voiceStates = global.guild_voice_states.get(guild_id);

    if (!voiceStates.find((y) => y.user_id === socket.user.id)) {
      voiceStates.push({
        user_id: socket.user.id,
        session_id: socket.session.id,
        guild_id: guild_id,
        channel_id: channel_id,
        mute: false,
        deaf: false,
        self_deaf: self_deaf,
        self_mute: self_mute,
        self_video: false,
        suppress: false,
      });
    }
  }

  if (!socket.inCall && socket.current_guild != null) {
    socket.session.dispatch('VOICE_SERVER_UPDATE', {
      token: globalUtils.generateString(30),
      guild_id: guild_id,
      channel_id: channel_id,
      endpoint: globalUtils.generateRTCServerURL(),
    });
    socket.inCall = true;
  }
}

async function handleOp12GetGuildMembersAndPresences(socket, packet) {
  if (!socket.session) return;

  const guild_ids = packet.d;

  if (guild_ids.length === 0) return;

  const usersGuilds = socket.session.guilds;

  if (usersGuilds.length === 0) return;

  for (var guild of guild_ids) {
    const guildObj = usersGuilds.find((x) => x.id === guild);

    if (!guildObj) continue;

    const op12 = await global.database.op12getGuildMembersAndPresences(guildObj);

    if (op12 == null) continue;

    socket.session.dispatch('GUILD_SYNC', {
      id: guildObj.id,
      presences: op12.presences,
      members: op12.members,
    });
  }
}

async function handleOp14GetGuildMemberChunks(socket, packet) {
  //This new rewritten code was mainly inspired by spacebar if you couldn't tell since their OP 14 is more stable than ours at the moment.
  //TO-DO: add support for shit like INSERT and whatnot (hell)

  await lazyRequest.fire(socket, packet);
}

async function handleResume(socket, packet) {
  const token = packet.d.token;
  const session_id = packet.d.session_id;

  if (!token || !session_id) return socket.close(4000, 'Invalid payload');

  if (socket.session || socket.resumed) return socket.close(4005, 'Cannot resume at this time');

  socket.resumed = true;

  const user2 = await global.database.getAccountByToken(token);

  if (!user2) {
    return socket.close(4004, 'Authentication failed');
  }

  socket.user = user2;

  const session2 = global.sessions.get(session_id);

  if (!session2) {
    const sesh = new session(
      globalUtils.generateString(16),
      socket,
      socket.user,
      packet.d.token,
      false,
      {
        game_id: null,
        status: socket.user?.settings?.status ?? 'online',
        activities: [],
        user: globalUtils.miniUserObject(socket.user),
        roles: [],
      },
      undefined,
      undefined,
      undefined,
      socket.apiVersion,
      packet.d.capabilities ?? socket.client_build_date,
    );

    sesh.seq = packet.d.seq;
    sesh.eventsBuffer = [];
    sesh.start();

    socket.session = sesh;
  }

  let sesh = null;

  if (!session2) {
    sesh = socket.session;
  } else sesh = session2;

  if (sesh.user.id !== socket.user.id) {
    return socket.close(4004, 'Authentication failed');
  }

  if (sesh.seq < packet.d.seq) {
    return socket.close(4007, 'Invalid seq');
  }

  if (sesh.eventsBuffer.find((x) => x.seq == packet.d.seq)) {
    socket.session = sesh;

    return await socket.session.resume(sesh.seq, socket);
  } else {
    sesh.send({
      op: OPCODES.INVALID_SESSION,
      d: false,
    });
  }
}

const gatewayHandlers = {
  [OPCODES.IDENTIFY]: handleIdentify,
  [OPCODES.HEARTBEAT]: handleHeartbeat,
  [OPCODES.PRESENCE]: handlePresence,
  [OPCODES.VOICESTATE]: handleVoiceState,
  [OPCODES.LAZYFETCH]: handleOp12GetGuildMembersAndPresences,
  [OPCODES.MEMBERCHUNKS]: handleOp14GetGuildMemberChunks,
  [OPCODES.RESUME]: handleResume,
};

export { gatewayHandlers, OPCODES };
