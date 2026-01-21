import udp from 'dgram';
import sodium, { add } from 'libsodium-wrappers';

import { OPCODES } from './handlers/rtc.js';
import { logText } from './helpers/logger.js';

// TODO: Replace all String() or "as type" conversions with better ones

const server = udp.createSocket('udp4');

const udpServer = {
  server: null as udp.Socket | null,
  port: null as number | null,
  debug_logs: false,
  clients: new Map(),
  encryptionsMap: new Map(),
  debug(message) {
    if (!this.debug_logs) {
      return;
    }

    logText(message, 'UDP_SERVER');
  },
  sendBytes(address, port, bytes) {
    server.send(
      bytes as string | readonly any[] | NodeJS.ArrayBufferView,
      port as number | undefined,
      address as string | undefined,
      (err) => {
        if (err) {
          this.debug(
            `Failed sending ${String(bytes.length)} bytes to ${String(address)}:${String(port)} -> ${err.message}`,
          );
          return false;
        }

        this.debug(`Sent ${String(bytes.length)} bytes to ${String(address)}:${String(port)}`);
        return true;
      },
    );
  },
  start(port, debug_logs = false) {
    this.port = port;
    this.debug_logs = debug_logs;

    server.on('listening', () => {
      const address = server.address();
      const ipaddr = address.address;

      this.debug(`Ready on ${ipaddr}:${String(this.port)}`);
    });

    server.on('error', (error) => {
      this.debug(`An unexpected error occurred: ${error.toString()}`);

      server.close();
    });

    server.on('message', (msg, info) => {
      if (msg.length < 4) {
        this.debug(`Message length check failed, packet had no ssrc.`);
        return;
      }

      const ssrc = msg.readUInt32BE(0);

      let session = this.clients.get(ssrc);

      if (!session) {
        let encryption = this.encryptionsMap.get(ssrc);

        encryption ??= {
          mode: 'xsalsa20_poly1305',
          key: [
            211, 214, 237, 8, 221, 92, 86, 132, 167, 57, 17, 71, 189, 169, 224, 211, 115, 17, 191,
            82, 96, 98, 107, 155, 92, 72, 52, 246, 52, 109, 142, 194,
          ],
        };

        const sesh = {
          ip_addr: info.address,
          ip_port: info.port,
          encryption_mode: encryption.mode,
          encryption_key: encryption.key,
        };

        this.clients.set(ssrc, sesh);

        session = sesh;
      }

      this.debug(
        `Incoming -> ${String(msg.length)} bytes from ${info.address}:${String(info.port)}`,
      );
      this.debug(
        `Attempted deserialization -> ${msg.toString('utf8')} from ${info.address}:${String(info.port)}`,
      );

      if (msg.length === 70) {
        //ip discovery

        const ssrc = msg.readUInt32BE(0);

        this.debug(`Received SSRC: ${String(ssrc)}`);

        const ipDiscoveryResponse = Buffer.alloc(70);

        ipDiscoveryResponse.writeUInt32LE(ssrc, 0);
        ipDiscoveryResponse.write(info.address, 4, 'utf8');
        ipDiscoveryResponse.writeUInt16LE(info.port, 68);

        this.sendBytes(info.address, info.port, ipDiscoveryResponse);
      } else if (msg.length === 8) {
        //ping packet(?)

        this.sendBytes(info.address, info.port, msg);
      } else if (msg.length > 12) {
        const ssrc = msg.readUInt32BE(8);
        const sequence = msg.readUInt16BE(2);
        const timestamp = msg.readUInt32BE(4);

        const session = this.clients.get(ssrc);

        if (!session) {
          this.debug(`Received voice data for unknown SSRC: ${String(ssrc)}`);
          return;
        }

        const voiceKey = Buffer.from(session.encryption_key);
        const rtpHeader = msg.subarray(0, 12);

        const nonce = Buffer.alloc(24).fill(0);
        msg.subarray(0, 12).copy(nonce, 0);

        const encryptedPayload = msg.subarray(12);

        const decryptedOpusData = sodium.crypto_secretbox_open_easy(
          encryptedPayload,
          nonce,
          voiceKey,
        );

        if (!decryptedOpusData) {
          this.debug(`Failed to decrypt voice packet from SSRC: ${String(ssrc)}`);
          return;
        }

        for (const [otherSsrc, otherSession] of this.clients) {
          if (otherSsrc !== ssrc) {
            const otherKey = Buffer.from(otherSession.encryption_key);

            const reEncryptionNonce = Buffer.alloc(24).fill(0);
            msg.subarray(0, 12).copy(reEncryptionNonce, 0);

            const reEncryptedPayload = sodium.crypto_secretbox_easy(
              decryptedOpusData,
              reEncryptionNonce,
              otherKey,
            );

            const reEncryptedPacket = Buffer.concat([
              msg.subarray(0, 12),
              typeof reEncryptedPayload === 'string'
                ? Buffer.from(reEncryptedPayload, 'utf8')
                : Buffer.from(reEncryptedPayload),
            ]);

            this.sendBytes(otherSession.ip_addr, otherSession.ip_port, reEncryptedPacket);

            for (const [_, clientSocket] of global.rtcServer.clients) {
              clientSocket.send(
                JSON.stringify({
                  op: OPCODES.SPEAKING,
                  d: {
                    ssrc: ssrc,
                    speaking: true,
                    delay: 0,
                  },
                }),
              );
            }
          }
        }
      }
    });

    server.bind(port as number | undefined);
  },
};

export default udpServer;
