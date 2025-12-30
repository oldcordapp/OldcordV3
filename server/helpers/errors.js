const errors = {
    response_400: {
        INVALID_FORM_BODY: {
            code: 50035,
            message: "Invalid Form Body"
        },
        TOO_MANY_USERS: {
            code: 30006,
            message: "Too many users have this username, please try another"
        },
        TWOFA_ALREADY_ENABLED: {
            code: 60001,
            message: "This account is already enrolled in two factor authentication"
        },
        TWOFA_NOT_ENABLED: {
            code: 60002,
            message: "This account is not enrolled in two factor authentication"
        }
    },
    response_401: {
        UNAUTHORIZED: {
            code: 0,
            message: "401: Unauthorized"
        }
    },
    response_403: {
        BOTS_CANNOT_USE_THIS_ENDPOINT: {
            code: 20001,
            message: "Bots cannot use this endpoint"
        },
        CANNOT_SEND_MESSAGES_TO_THIS_USER: {
            code: 50007,
            message: "Cannot send messages to this user"
        },
        BOTS_CANNOT_HAVE_FRIENDS: {
            code: 80002,
            message: "Bots cannot have friends"
        },
        CANNOT_FRIEND_SELF: {
            code: 80003,
            message: "Cannot send friend request to self"
        },
        ONLY_BOTS_CAN_USE_THIS_ENDPOINT: {
            code: 20001,
            message: "Bots cannot use this endpoint"
        },
        MISSING_PERMISSIONS: {
            code: 50013,
            message: "Missing Permissions"
        },
        MISSING_ACCESS: {
            code: 50001,
            message: "Missing Access"
        }
    },
    response_404: {
        UNKNOWN_ACCOUNT: {
            code: 10001,
            message: "Unknown Account"
        },
        UNKNOWN_APPLICATION: {
            code: 10002,
            message: "Unknown Application"
        },
        UNKNOWN_CHANNEL: {
            code: 10003,
            message: "Unknown Channel"
        },
        UNKNOWN_GUILD: {
            code: 10004,
            message: "Unknown Guild"
        },
        UNKNOWN_INTEGRATION: {
            code: 10005,
            message: "Unknown Integration"
        },
        UNKNOWN_INVITE: {
            code: 10006,
            message: "Unknown Invite"
        },
        UNKNOWN_MEMBER: {
            code: 10007,
            message: "Unknown Member"
        },
        UNKNOWN_MESSAGE: {
            code: 10008,
            message: "Unknown Message"
        },
        UNKNOWN_OVERWRITE: {
            code: 10009,
            message: "Unknown Overwrite"
        },
        UNKNOWN_ROLE: {
            code: 10011,
            message: "Unknown Role"
        },
        UNKNOWN_TOKEN: {
            code: 10012,
            message: "Unknown Token"
        },
        UNKNOWN_USER: {
            code: 10013,
            message: "Unknown User"
        },
        UNKNOWN_EMOJI: {
            code: 10014,
            message: "Unknown Emoji"
        },
        UNKNOWN_WEBHOOK: {
            code: 10015,
            message: "Unknown Webhook"
        },
        UNKNOWN_CONNECTION: {
            code: 10017,
            message: "Unknown Connection"
        },
        UNKNOWN_SUBSCRIPTION_PLAN: {
            code: 10073,
            message: "Unknown Subscription Plan"
        }
    },
    response_405: {
        METHOD_NOT_ALLOWED: {
            message: "405: Method Not Allowed",
            code: 0
        }
    },
    response_500: {
        INTERNAL_SERVER_ERROR: {
            code: 0,
            message: "Internal Server Error"
        },
    },
    response_502: {
        BAD_GATEWAY: {
            code: 0,
            message: "Bad Gateway"
        }
    }
};

module.exports = errors;