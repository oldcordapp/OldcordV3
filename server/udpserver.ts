import udp from 'dgram';
import sodium from 'libsodium-wrappers';

import { OPCODES } from './handlers/rtc.js';
import { logText } from './helpers/logger.js';

const server = udp.createSocket('udp4');

const udpServer = {
  server: null as udp.Socket | null,
  port: null as number | null,
  debug_logs: false,
  clients: new Map<number, Session>(),
  encryptionsMap: new Map<number, Encryption>(),

  debug(message: string) {
    if (!this.debug_logs) {
      return;
    }
    logText(message, 'UDP_SERVER');
  },

  sendBytes(address: string, port: number, bytes: Buffer | Uint8Array) {
    server.send(bytes, port, address, (err) => {
      if (err) {
        this.debug(
          `Failed sending ${String(bytes.length)} bytes to ${address}:${String(port)} -> ${err.message}`,
        );
        return;
      }

      this.debug(`Sent ${String(bytes.length)} bytes to ${address}:${String(port)}`);
    });
  },

  start(port: number, debug_logs = false) {
    this.port = port;
    this.debug_logs = debug_logs;

    server.on('listening', () => {
      const address = server.address();
      const ipaddr = address.address;

      this.debug(`Ready on ${ipaddr}:${String(this.port)}`);
    });

    server.on('error', (error: Error) => {
      this.debug(`An unexpected error occurred: ${error.toString()}`);
      server.close();
    });

    server.on('message', (msg: Buffer, info: udp.RemoteInfo) => {
      if (msg.length < 4) {
        this.debug(`Message length check failed, packet had no ssrc.`);
        return;
      }

      const ssrc = msg.readUInt32BE(0);
      let session = this.clients.get(ssrc);

      if (!session) {
        const encryption = this.encryptionsMap.get(ssrc) ?? {
          mode: 'xsalsa20_poly1305',
          key: [
            211, 214, 237, 8, 221, 92, 86, 132, 167, 57, 17, 71, 189, 169, 224, 211, 115, 17, 191,
            82, 96, 98, 107, 155, 92, 72, 52, 246, 52, 109, 142, 194,
          ],
        };

        session = {
          ip_addr: info.address,
          ip_port: info.port,
          encryption_mode: encryption.mode,
          encryption_key: encryption.key,
        };

        this.clients.set(ssrc, session);
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
        const session = this.clients.get(ssrc);
        if (!session) {
          this.debug(`Received voice data for unknown SSRC: ${String(ssrc)}`);
          return;
        }

        const voiceKey = Buffer.from(session.encryption_key);
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

            /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- remove global later */
            const rtcServer = (global as any).rtcServer;
            if (rtcServer?.clients) {
              for (const [, clientSocket] of rtcServer.clients as Map<string, any>) {
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
      }
    });

    server.bind(port);
  },
};

export default udpServer;
