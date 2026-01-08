const cluster = require("cluster");
const { DiscordSnowflake } = require("@sapphire/snowflake");

// https://github.com/discordjs/discord.js/blob/master/src/util/Snowflake.js
// Apache License Version 2.0 Copyright 2015 - 2021 Amish Shah
// Stolen from fosscord, thanks
// Modified to use @sapphire/snowflake as a compat layer because of bigint concerns

class Snowflake {
    static INCREMENT = BigInt(0); // max 4095
    static processId = BigInt(process.pid % 31); // max 31
    static workerId = BigInt((cluster.worker?.id || 0) % 31); // max 31

    constructor() {
        throw new Error(`The ${this.constructor.name} class may not be instantiated.`);
    }

    static generate() {
        return DiscordSnowflake.generate({increment: Snowflake.INCREMENT, processId: Snowflake.processId, workerId: Snowflake.workerId}).toString();
    }

    static deconstruct(snowflake) {
        const deconstructed = DiscordSnowflake.deconstruct(snowflake);
        const res = {
            timestamp: Number(deconstructed.timestamp),
            workerID: Number(deconstructed.workerId),
            processID: Number(deconstructed.processId),
            increment: Number(deconstructed.increment),
            binary: BigInt(snowflake).toString(2).padStart(64, "0")
        };
        Object.defineProperty(res, "date", {
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

            const timestamp = deconstructed.timestamp;
            const workerID = deconstructed.workerID;
            const processID = deconstructed.processID;
            const increment = deconstructed.increment;

            if (maxAge != null && Date.now() - maxAge > (1000 * 60 * 30)) {
                return false;
            }

            if (timestamp < DiscordSnowflake.epoch) return false;

            if (workerID < 0 || workerID > 31) return false;
            if (processID < 0 || processID > 31) return false;

            if (increment < 0 || increment > 4095) return false;

            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = Snowflake;
