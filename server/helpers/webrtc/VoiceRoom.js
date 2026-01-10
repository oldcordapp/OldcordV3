class VoiceRoom {
  constructor(id, type, sfu, router) {
    this._id = id;
    this._type = type;
    this._clients = new Map();
    this._sfu = sfu;
    this._router = router;
  }

  onClientJoin = (client) => {
    this._clients.set(client.user_id, client);
  };

  onClientOffer = (client, transport, codecs, rtpHeaders) => {
    client.transport = transport;
    client.codecs = codecs;
    client.headerExtensions = rtpHeaders;

    const supportedCodecs = global.MEDIA_CODECS.map((codec) => {
      const codecName = codec.mimeType.split('/')[1];
      const alternativePayloadType = codecName === 'opus' ? 111 : 102;
      return {
        ...codec,
        preferredPayloadType:
          codecs.find((c) => c.name.toUpperCase() === codecName.toUpperCase())?.payload_type ??
          alternativePayloadType,
      };
    });

    client.codecCapabilities = supportedCodecs;
  };

  onClientLeave = (client) => {
    this._clients.delete(client.user_id);

    for (const otherClient of this.clients.values()) {
      if (otherClient.user_id === client.user_id) continue;

      otherClient.consumers?.forEach((consumer) => {
        if (
          client?.audioProducer?.id === consumer.producerId ||
          client?.videoProducer?.id === consumer.producerId
        ) {
          consumer.close();
        }
      });
    }

    client.consumers?.forEach((consumer) => consumer.close());
    client.audioProducer?.close();
    client.videoProducer?.close();
    client.transport?.close();
    client.isStopped = true;
    client.room = undefined;
    client.audioProducer = undefined;
    client.videoProducer = undefined;
    client.consumers = [];
    client.transport = undefined;
    client.websocket = undefined;
    client.emitter.removeAllListeners();
  };

  get clients() {
    return this._clients;
  }

  getClientById = (id) => {
    return this._clients.get(id);
  };

  get id() {
    return this._id;
  }

  get type() {
    return this._type;
  }

  get router() {
    return this._router;
  }
}

module.exports = { VoiceRoom };
