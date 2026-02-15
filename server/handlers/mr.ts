import ws from 'ws';

const { EventEmitter } = ws;

const OPCODES = {
  IDENTIFY: 'IDENTIFY',
  ALRIGHT: 'ALRIGHT',
  HEARTBEAT_INFO: 'HEARTBEAT_INFO',
  ANSWER: 'ANSWER',
  VIDEO_BATCH: 'VIDEO_BATCH',
  SPEAKING_BATCH: 'SPEAKING_BATCH',
  HEARTBEAT: 'HEARTBEAT',
  HEARTBEAT_ACK: 'HEARTBEAT_ACK',
};

async function handleIdentify(socket: any, packet: any) {
  const public_ip = packet.d.public_ip;
  const public_port = packet.d.public_port;
  const lat = packet.d.lat || 0;
  const lon = packet.d.lon || 0;
  const timestamp = packet.d.timestamp;

  global.mrServer.debug(`New media server has connected! Added to internal store.`);

  socket.public_ip = public_ip;
  socket.public_port = public_port;
  socket.emitter = new EventEmitter();

  global.mrServer.servers.set(public_ip, {
    socket: socket,
    port: public_port,
    lat: lat,
    lon: lon,
    seen_at: timestamp,
  });

  socket.send(
    JSON.stringify({
      op: OPCODES.ALRIGHT,
      d: {
        location: global.mrServer.servers.size,
        config: global.config.mr_server.config,
      },
    }),
  );
}

async function handleHeartbeat(socket: any, packet: any) {
  if (!socket.hb) return;

  socket.hb.acknowledge(packet.d);
  socket.hb.reset();
}

async function handleAnswer(socket: any, packet: any) {
  socket.emitter.emit('answer-received', packet.d);
}

async function handleVideoBatch(socket: any, packet: any) {
  socket.emitter.emit('video-batch', packet.d);
}

async function handleSpeakingBatch(socket: any, packet: any) {
  socket.emitter.emit('speaking-batch', packet.d);
}

const mrHandlers = {
  [OPCODES.IDENTIFY]: handleIdentify,
  [OPCODES.HEARTBEAT]: handleHeartbeat,
  [OPCODES.ANSWER]: handleAnswer,
  [OPCODES.VIDEO_BATCH]: handleVideoBatch,
  [OPCODES.SPEAKING_BATCH]: handleSpeakingBatch,
};

export { mrHandlers, OPCODES };
