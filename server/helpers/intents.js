const Intents = {
    Data: {
        [1 << 0]: {
            name: "GUILDS",
            events: [
                "GUILD_CREATE", "GUILD_UPDATE", "GUILD_DELETE", "GUILD_ROLE_CREATE",
                "GUILD_ROLE_UPDATE", "GUILD_ROLE_DELETE", "CHANNEL_CREATE", "CHANNEL_UPDATE",
                "CHANNEL_DELETE", 
            ]
        },
        [1 << 1]: {
            name: "GUILD_MEMBERS",
            events: ["GUILD_MEMBER_ADD", "GUILD_MEMBER_UPDATE", "GUILD_MEMBER_REMOVE"]
        },
        [1 << 2]: {
            name: "GUILD_MODERATION",
            events: ["GUILD_AUDIT_LOG_ENTRY_CREATE", "GUILD_BAN_ADD", "GUILD_BAN_REMOVE"]
        },
        [1 << 3]: {
            name: "GUILD_EXPRESSIONS",
            events: [
                "GUILD_EMOJIS_UPDATE"
            ]
        },
        [1 << 4]: {
            name: "GUILD_INTEGRATIONS",
            events: ["GUILD_INTEGRATIONS_UPDATE", "INTEGRATION_CREATE", "INTEGRATION_UPDATE", "INTEGRATION_DELETE"]
        },
        [1 << 5]: {
            name: "GUILD_WEBHOOKS",
            events: ["WEBHOOKS_UPDATE"]
        },
        [1 << 6]: {
            name: "GUILD_INVITES",
            events: ["INVITE_CREATE", "INVITE_DELETE"]
        },
        [1 << 7]: {
            name: "GUILD_VOICE_STATES",
            events: ["VOICE_STATE_UPDATE"]
        },
        [1 << 8]: {
            name: "GUILD_PRESENCES",
            events: ["PRESENCE_UPDATE"]
        },
        [1 << 9]: {
            name: "GUILD_MESSAGES",
            events: ["MESSAGE_DELETE_BULK"]
        },
        [1 << 10]: {
            name: "GUILD_MESSAGE_REACTIONS",
            events: []
        },
        [1 << 11]: {
            name: "GUILD_MESSAGE_TYPING",
            events: []
        },
        [1 << 12]: {
            name: "DIRECT_MESSAGES",
            events: []
        },
        [1 << 13]: {
            name: "DIRECT_MESSAGE_REACTIONS",
            events: []
        },
        [1 << 14]: {
            name: "DIRECT_MESSAGE_TYPING",
            events: []
        },
        [1 << 15]: {
            name: "MESSAGE_CONTENT",
            events: []
        }
    },
    EventToBit: {},
    ComplexEvents: {
        "MESSAGE_CREATE": (p) => p.guild_id ? (1 << 9) : (1 << 12),
        "MESSAGE_UPDATE": (p) => p.guild_id ? (1 << 9) : (1 << 12),
        "MESSAGE_DELETE": (p) => p.guild_id ? (1 << 9) : (1 << 12),
        "TYPING_START": (p) => p.guild_id ? (1 << 11) : (1 << 14),
        "MESSAGE_REACTION_ADD": (p) => p.guild_id ? (1 << 10) : (1 << 13),
        "MESSAGE_REACTION_REMOVE": (p) => p.guild_id ? (1 << 10) : (1 << 13),
        "MESSAGE_REACTION_REMOVE_ALL": (p) => p.guild_id ? (1 << 10) : (1 << 13),
        "MESSAGE_REACTION_REMOVE_EMOJI": (p) => p.guild_id ? (1 << 10) : (1 << 13),
        "CHANNEL_PINS_UPDATE": (p) => p.guild_id ? (1 << 0) : (1 << 12)
    }
};

for (const [bit, value] of Object.entries(Intents.Data)) {
    for (const event of value.events) {
        Intents.EventToBit[event] = Number(bit);
    }
}

module.exports = Intents;