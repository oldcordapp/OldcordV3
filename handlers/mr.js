const { EventEmitter } = require("ws");
const globalUtils = require("../helpers/globalutils");
const session = require("../helpers/session");

const OPCODES = {
    IDENTIFY: "IDENTIFY",
    ALRIGHT: "ALRIGHT",
    HEARTBEAT_INFO: "HEARTBEAT_INFO",
    ANSWER: "ANSWER",
    VIDEO_BATCH: "VIDEO_BATCH",
    SPEAKING_BATCH: "SPEAKING_BATCH",
    HEARTBEAT: "HEARTBEAT",
    HEARTBEAT_ACK: "HEARTBEAT_ACK",
};

async function handleIdentify(socket, packet) {
    let public_ip = packet.d.public_ip;
    let public_port = packet.d.public_port;
    let timestamp = packet.d.timestamp;

    global.mrServer.debug(`New media server has connected! Added to internal store.`);

    //to-do find a proper & fast way to lookup these public ips to serve whats close to a user
    
    socket.public_ip = public_ip;
    socket.public_port = public_port;
    socket.emitter = new EventEmitter();

    global.mrServer.servers.set(public_ip, {
        socket: socket,
        port: public_port,
        seen_at: timestamp
    });

    socket.send(JSON.stringify({
        op: OPCODES.ALRIGHT,
        d: {
            location: global.mrServer.servers.size + 1
        }
    }));
}

async function handleHeartbeat(socket, packet) {
    if (!socket.hb) return;

    socket.hb.acknowledge(packet.d);
    socket.hb.reset();
}

async function handleAnswer(socket, packet) {
    socket.emitter.emit('answer-received', packet.d);
}

async function handleVideoBatch(socket, packet) {
    socket.emitter.emit('video-batch', packet.d);
}


async function handleSpeakingBatch(socket, packet) {
    socket.emitter.emit('speaking-batch', packet.d);
}

const mrHandlers = {
    [OPCODES.IDENTIFY]: handleIdentify,
    [OPCODES.HEARTBEAT]: handleHeartbeat,
    [OPCODES.ANSWER]: handleAnswer,
    [OPCODES.VIDEO_BATCH]: handleVideoBatch,
    [OPCODES.SPEAKING_BATCH]: handleSpeakingBatch
};

module.exports = {
    mrHandlers,
    OPCODES
};