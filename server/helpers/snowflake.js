import { worker } from 'cluster';
import { Snowflake as SapphireSnowflake } from '@sapphire/snowflake';

const EPOCH = 1420070400000n;
const snowflakeInstance = new SapphireSnowflake(EPOCH);

class Snowflake {
  static processId = BigInt(process.pid % 31);
  static workerId = BigInt((worker?.id || 0) % 31);

  constructor() {
    throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
  }

  static generate() {
    return snowflakeInstance
      .generate({
        processId: Snowflake.processId,
        workerId: Snowflake.workerId,
      })
      .toString();
  }

  static deconstruct(snowflake) {
    const deconstructed = snowflakeInstance.deconstruct(snowflake);

    const res = {
      timestamp: Number(deconstructed.timestamp),
      workerID: Number(deconstructed.workerId),
      processID: Number(deconstructed.processId),
      increment: Number(deconstructed.increment),
      binary: BigInt(snowflake).toString(2).padStart(64, '0'),
    };

    Object.defineProperty(res, 'date', {
      get: function get() {
        return new Date(this.timestamp);
      },
      enumerable: true,
    });

    return res;
  }

  static isValid(snowflake, maxAge = null) {
    if (!/^\d+$/.test(snowflake)) return false;
    if (snowflake.length < 11) return false;

    try {
      const deconstructed = Snowflake.deconstruct(snowflake);

      if (deconstructed.timestamp > Date.now() || deconstructed.timestamp < Number(EPOCH)) {
        return false;
      }

      if (maxAge != null && Date.now() - deconstructed.timestamp > maxAge) {
        return false;
      }

      if (deconstructed.workerID < 0 || deconstructed.workerID > 31) return false;
      if (deconstructed.processID < 0 || deconstructed.processID > 31) return false;
      if (deconstructed.increment < 0 || deconstructed.increment > 4095) return false;

      return true;
    } catch (error) {
      return false;
    }
  }
}

export default Snowflake;
