export enum GatewayIntentBits {
    GUILDS = 1 << 0,
    GUILD_MEMBERS = 1 << 1,
    GUILD_MODERATION = 1 << 2,
    GUILD_EXPRESSIONS = 1 << 3,
    GUILD_INTEGRATIONS = 1 << 4,
    GUILD_WEBHOOKS = 1 << 5,
    GUILD_INVITES = 1 << 6,
    GUILD_VOICE_STATES = 1 << 7,
    GUILD_PRESENCES = 1 << 8,
    GUILD_MESSAGES = 1 << 9,
    GUILD_MESSAGE_REACTIONS = 1 << 10,
    GUILD_MESSAGE_TYPING = 1 << 11,
    DIRECT_MESSAGES = 1 << 12,
    DIRECT_MESSAGE_REACTIONS = 1 << 13,
    DIRECT_MESSAGE_TYPING = 1 << 14,
    MESSAGE_CONTENT = 1 << 15,
}

interface IntentData {
    name: string;
    events: string[];
}

export const Intents = {
    Data: {
        [GatewayIntentBits.GUILDS]: {
            name: "GUILDS",
            events: [
                "GUILD_CREATE", "GUILD_UPDATE", "GUILD_DELETE", "GUILD_ROLE_CREATE",
                "GUILD_ROLE_UPDATE", "GUILD_ROLE_DELETE", "CHANNEL_CREATE", "CHANNEL_UPDATE",
                "CHANNEL_DELETE", 
            ]
        },
        [GatewayIntentBits.GUILD_MEMBERS]: {
            name: "GUILD_MEMBERS",
            events: ["GUILD_MEMBER_ADD", "GUILD_MEMBER_UPDATE", "GUILD_MEMBER_REMOVE"]
        },
        [GatewayIntentBits.GUILD_MODERATION]: {
            name: "GUILD_MODERATION",
            events: ["GUILD_AUDIT_LOG_ENTRY_CREATE", "GUILD_BAN_ADD", "GUILD_BAN_REMOVE"]
        },
        [GatewayIntentBits.GUILD_EXPRESSIONS]: {
            name: "GUILD_EXPRESSIONS",
            events: [
                "GUILD_EMOJIS_UPDATE"
            ]
        },
        [GatewayIntentBits.GUILD_INTEGRATIONS]: {
            name: "GUILD_INTEGRATIONS",
            events: ["GUILD_INTEGRATIONS_UPDATE", "INTEGRATION_CREATE", "INTEGRATION_UPDATE", "INTEGRATION_DELETE"]
        },
        [GatewayIntentBits.GUILD_WEBHOOKS]: {
            name: "GUILD_WEBHOOKS",
            events: ["WEBHOOKS_UPDATE"]
        },
        [GatewayIntentBits.GUILD_INVITES]: {
            name: "GUILD_INVITES",
            events: ["INVITE_CREATE", "INVITE_DELETE"]
        },
        [GatewayIntentBits.GUILD_VOICE_STATES]: {
            name: "GUILD_VOICE_STATES",
            events: ["VOICE_STATE_UPDATE"]
        },
        [GatewayIntentBits.GUILD_PRESENCES]: {
            name: "GUILD_PRESENCES",
            events: ["PRESENCE_UPDATE"]
        },
        [GatewayIntentBits.GUILD_MESSAGES]: {
            name: "GUILD_MESSAGES",
            events: ["MESSAGE_DELETE_BULK"]
        },
        [GatewayIntentBits.GUILD_MESSAGE_REACTIONS]: {
            name: "GUILD_MESSAGE_REACTIONS",
            events: []
        },
        [GatewayIntentBits.GUILD_MESSAGE_TYPING]: {
            name: "GUILD_MESSAGE_TYPING",
            events: []
        },
        [GatewayIntentBits.DIRECT_MESSAGES]: {
            name: "DIRECT_MESSAGES",
            events: []
        },
        [GatewayIntentBits.DIRECT_MESSAGE_REACTIONS]: {
            name: "DIRECT_MESSAGE_REACTIONS",
            events: []
        },
        [GatewayIntentBits.DIRECT_MESSAGE_TYPING]: {
            name: "DIRECT_MESSAGE_TYPING",
            events: []
        },
        [GatewayIntentBits.MESSAGE_CONTENT]: {
            name: "MESSAGE_CONTENT",
            events: []
        }
    } as Record<number, IntentData>,  
    EventToBit: {} as Record<string, number>,
    ComplexEvents: {
        "MESSAGE_CREATE": (p: any) => p.guild_id ? (1 << 9) : (1 << 12),
        "MESSAGE_UPDATE": (p: any) => p.guild_id ? (1 << 9) : (1 << 12),
        "MESSAGE_DELETE": (p: any) => p.guild_id ? (1 << 9) : (1 << 12),
        "TYPING_START": (p: any) => p.guild_id ? (1 << 11) : (1 << 14),
        "MESSAGE_REACTION_ADD": (p: any) => p.guild_id ? (1 << 10) : (1 << 13),
        "MESSAGE_REACTION_REMOVE": (p: any) => p.guild_id ? (1 << 10) : (1 << 13),
        "MESSAGE_REACTION_REMOVE_ALL": (p: any) => p.guild_id ? (1 << 10) : (1 << 13),
        "MESSAGE_REACTION_REMOVE_EMOJI": (p: any) => p.guild_id ? (1 << 10) : (1 << 13),
        "CHANNEL_PINS_UPDATE": (p: any) => p.guild_id ? (1 << 0) : (1 << 12)
    } as Record<string, (p: any) => number>
};

for (const [bit, value] of Object.entries(Intents.Data)) {
    for (const event of value.events) {
        Intents.EventToBit[event] = Number(bit);
    }
}

module.exports = Intents;