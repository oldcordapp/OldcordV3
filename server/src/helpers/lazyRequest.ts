import { Channel } from "../types/channel";
import { Guild } from "../types/guild";
import { Member } from "../types/member";
import { Role } from "../types/role";
import permissions, { PermissionBits } from "./permissions";
import globalUtils from "./globalutils";
import murmur from "murmurhash-js";
import { GatewayClientSocket } from "../types/socket";
import { GatewayPacket } from "../types/gatewaypacket";

type MemberListItem = 
    | { group: { id: string; count: number } } 
    | { member: Member & { presence: any } };

type MemberListCache = {
    [channelId: string]: MemberListItem[];
};

function isMember(item: MemberListItem): item is { member: Member & { presence: any } } {
    return 'member' in item;
}

export const lazyRequest = {
    getSortedList: (guild: Guild) => {
        return [...guild.members].sort((a, b) => {
            let pA = globalUtils.getUserPresence(a);
            let pB = globalUtils.getUserPresence(b);
            let statusA = (pA?.status && pA.status !== 'offline') ? 1 : 0;
            let statusB = (pB?.status && pB.status !== 'offline') ? 1 : 0;

            if (statusA !== statusB) return statusB - statusA;
            return a.user.username.localeCompare(b.user.username);
        });
    },
    getListId: (session: any, guild: Guild, channel: Channel | null, everyoneRole: Role) => {
        if (!channel) {
            if (!session.subscriptions) {
                session.subscriptions = {};
            }

            session.subscriptions[guild.id] = {};

            return murmur.murmur3("", 0).toString();
        }

        const READ_BIT = BigInt(PermissionBits.READ_MESSAGES);
        const everyonePerms = BigInt(everyoneRole.permissions);

        let everyoneOverwrite = channel.permission_overwrites.find(ov => ov.id === everyoneRole.id);
        let everyoneCanView = (everyonePerms & READ_BIT) === READ_BIT;

        if (everyoneOverwrite && (BigInt(everyoneOverwrite.deny) & READ_BIT) === READ_BIT) {
            everyoneCanView = false;
        }

        let otherDenyRules = channel.permission_overwrites.some(ov => 
            ov.id !== everyoneRole.id && (BigInt(ov.deny) & READ_BIT) === READ_BIT
        );

        if (everyoneCanView && !otherDenyRules) {
            return "everyone";
        }

        let perms: string[] = [];

        channel.permission_overwrites.forEach((overwrite) => {
            const allow = BigInt(overwrite.allow);
            const deny = BigInt(overwrite.deny);
            if ((allow & READ_BIT) === READ_BIT) {
                perms.push(`allow:${overwrite.id}`);
            } else if ((deny & READ_BIT) === READ_BIT) {
                perms.push(`deny:${overwrite.id}`);
            }
        });

        if (perms.length === 0) {
            return murmur.murmur3("", 0).toString();
        }

        return murmur.murmur3(perms.sort().join(","), 0).toString();
    },
    computeMemberList: (guild: Guild, channel: Channel, ranges: number[][], bypassPerms = false) => {
        // Fix: Properly typed generic array partitioner
        const arrayPartition = <T>(array: T[], callback: (elem: T) => boolean): [T[], T[]] => {
            return array.reduce(([pass, fail], elem) => {
                return callback(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
            }, [[], []] as [T[], T[]]);
        };

        const formatMemberItem = (member: Member, forcedStatus: string | null = null): { member: any } => {
            let p = globalUtils.getUserPresence(member);
            if (forcedStatus != null) p.status = forcedStatus;
            return {
                member: { ...member, presence: p }
            };
        };

        let visibleMembers = guild.members.filter(m => {
            return global.permissions.hasChannelPermissionTo(channel, guild, m.id, "READ_MESSAGES") || bypassPerms;
        });

        let sortedMembers = [...visibleMembers].sort((a, b) => {
            let pA = globalUtils.getUserPresence(a);
            let pB = globalUtils.getUserPresence(b);
            let statusA = (pA?.status && pA.status !== 'offline') ? 1 : 0;
            let statusB = (pB?.status && pB.status !== 'offline') ? 1 : 0;
            if (statusA !== statusB) return statusB - statusA;
            return a.user.username.localeCompare(b.user.username);
        });

        let allItems: MemberListItem[] = [];
        let groups: { id: string, count: number }[] = [];
        let placedUserIds = new Set<string>();
        let remainingMembers = [...sortedMembers];

        let hoistedRoles = (guild.roles || []).filter(r => r.hoist).sort((a, b) => b.position - a.position);
        
        hoistedRoles.forEach(role => {
            let [roleMembers, others] = arrayPartition(remainingMembers, m => {
                if (placedUserIds.has(m.id)) return false;
                let p = globalUtils.getUserPresence(m);
                return p && p.status !== 'offline' && m.roles.includes(role.id);
            });

            if (roleMembers.length > 0) {
                groups.push({ id: role.id, count: roleMembers.length });
                allItems.push({ group: { id: role.id, count: roleMembers.length } });
                roleMembers.forEach((m: Member) => {
                    allItems.push(formatMemberItem(m));
                    placedUserIds.add(m.id);
                });
            }
            remainingMembers = others;
        });

        let [onlineLeft, others] = arrayPartition(remainingMembers, m => {
            if (placedUserIds.has(m.id)) return false;
            let p = globalUtils.getUserPresence(m);
            return p && p.status !== 'offline' && p.status !== 'invisible';
        });

        if (onlineLeft.length > 0) {
            groups.push({ id: "online", count: onlineLeft.length });
            allItems.push({ group: { id: "online", count: onlineLeft.length } });
            onlineLeft.forEach(m => {
                allItems.push(formatMemberItem(m));
                placedUserIds.add(m.id);
            });
        }

        let offlineFinal = others.filter(m => !placedUserIds.has(m.id));
        if (offlineFinal.length > 0) {
            groups.push({ id: "offline", count: offlineFinal.length });
            allItems.push({ group: { id: "offline", count: offlineFinal.length } });
            offlineFinal.forEach(m => {
                allItems.push(formatMemberItem(m, "offline"));
                placedUserIds.add(m.id);
            });
        }

        let syncOps = ranges.map(range => {
            let [startIndex, endIndex] = range;
            return {
                op: "SYNC",
                range,
                items: allItems.slice(startIndex, endIndex + 1)
            };
        });

        return {
            ops: syncOps,
            groups,
            items: allItems,
            count: visibleMembers.length
        };
    },
    clearGuildSubscriptions: (session: any, guildId: string) => {
        if (session.subscriptions?.[guildId]) delete session.subscriptions[guildId];
        if (session.memberListCache) {
            for (let key in session.memberListCache) {
                if (key.startsWith(guildId)) delete session.memberListCache[key];
            }
        }
    },
    handleMemberRemove: async (session: any, guild: Guild, memberId: string) => {
        let guildSubs = session.subscriptions[guild.id];
        if (!guildSubs) return;

        let leaverSession = Array.from(global.sessions.values()).find(s => s.user.id === memberId);
        if (leaverSession) {
            lazyRequest.clearGuildSubscriptions(leaverSession, guild.id);
        }

        for (let [channelId, subData] of Object.entries(guildSubs) as [string, any][]) {
            let channel = guild.channels.find(x => x.id === channelId);
            if (!channel) continue;

            let everyoneRole = guild.roles.find(x => x.id === guild.id)!;

            let list_id = lazyRequest.getListId(session, guild, channel, everyoneRole);
            let ops = [];

            let oldItems: MemberListItem[] = session.memberListCache[channelId];

            if (!oldItems) continue;

            let tempGuild = { ...guild, members: guild.members.filter(m => m.id !== memberId) };
            let { items: newItems, groups, count } = lazyRequest.computeMemberList(tempGuild, channel, subData.ranges);
            let totalOnline = groups.filter(g => g.id !== "offline").reduce((acc, g) => acc + g.count, 0);

            if (global.config.sync_only) {
                ops = subData.ranges.map((range: any) => ({
                    op: "SYNC",
                    range: range,
                    items: newItems.slice(range[0], range[1] + 1)
                }));
            } else {
                let visualIndex = oldItems.findIndex(i => isMember(i) && (i.member.id === memberId || i.member.user?.id === memberId));
                if (visualIndex === -1) continue;

                ops.push({ op: "DELETE", index: visualIndex });

                if (visualIndex > 0) {
                    const prevItem = oldItems[visualIndex - 1];

                    if ('group' in prevItem && prevItem.group.count === 1) {
                        ops.push({ op: "DELETE", index: visualIndex - 1 });
                    }
                }
            }

            session.memberListCache[channelId] = newItems;

            session.dispatch("GUILD_MEMBER_LIST_UPDATE", {
                guild_id: guild.id,
                id: list_id,
                ops: ops,
                groups: groups,
                member_count: count,
                online_count: totalOnline
            });
        }

        guild.members = guild.members.filter(m => m.id !== memberId);
    },
    handleMemberAdd: async (session: any, guild: Guild, member: Member) => {
        let guildSubs = session.subscriptions[guild.id];
        if (!guildSubs) return;

        const memberId = member.id || member.user?.id;

        if (!guild.members.find(m => m.id === memberId)) {
            guild.members.push(member);
        }

        for (let [channelId, subData] of Object.entries(guildSubs) as [string, any][]) {
            let channel = guild.channels.find(x => x.id === channelId);
            if (!channel) continue;

            let { items: newItems, groups, count } = lazyRequest.computeMemberList(guild, channel, subData.ranges);

            let everyoneRole = guild.roles.find(x => x.id === guild.id)!;
            let list_id = lazyRequest.getListId(session, guild, channel, everyoneRole);
            let totalOnline = groups.filter(g => g.id !== 'offline').reduce((acc, g) => acc + g.count, 0);

            let ops = [];

            if (global.config.sync_only) {
                ops = subData.ranges.map((range: any) => ({
                    op: "SYNC",
                    range: range,
                    items: newItems.slice(range[0], range[1] + 1)
                }));
            } else {
                let oldItems: MemberListItem[] = session.memberListCache[channelId] || [];
                let visualIndex = newItems.findIndex(i => isMember(i) && String(i.member.id || i.member.user?.id) === String(memberId));

                if (visualIndex !== -1) {
                    const currentItem = newItems[visualIndex];
                    
                    if (visualIndex > 0) {
                        const potentialGroupItem = newItems[visualIndex - 1];

                        if ('group' in potentialGroupItem) {
                            let newGroup = potentialGroupItem.group;
                            let oldGroupIdx = oldItems.findIndex(i => 'group' in i && i.group.id === newGroup.id);

                            if (oldGroupIdx === -1) {
                                ops.push({ op: "INSERT", index: visualIndex - 1, item: potentialGroupItem });
                            } else {
                                ops.push({ op: "UPDATE", index: oldGroupIdx, item: potentialGroupItem });
                            }
                        }
                    }
                    ops.push({ op: "INSERT", index: visualIndex, item: currentItem });
                }
            }

            session.memberListCache[channelId] = newItems;

            if (ops.length > 0) {
                session.dispatch("GUILD_MEMBER_LIST_UPDATE", {
                    guild_id: guild.id,
                    id: list_id,
                    ops: ops,
                    groups: groups,
                    member_count: count,
                    online_count: totalOnline
                });
            }
        }
    },
    handleMembersSync: (session: any, channel: Channel, guild: Guild, subData: any) => {
        if (!subData || !subData.ranges) return;

        let everyoneRole = guild.roles.find(x => x.id === guild.id)!;
        let list_id = lazyRequest.getListId(session, guild, channel, everyoneRole);

        let {
            ops,
            groups,
            items,
            count
        } = lazyRequest.computeMemberList(guild, channel, subData.ranges);

        let onlineCount = groups
            .filter(g => g.id === "online" || guild.roles.some(r => r.id === g.id && r.hoist))
            .reduce((acc, g) => acc + g.count, 0);

        if (!session.memberListCache) {
            session.memberListCache = {};
        } //kick causes that error

        session.memberListCache[channel.id] = items;

        session.dispatch("GUILD_MEMBER_LIST_UPDATE", {
            guild_id: guild.id,
            id: list_id,
            ops: ops,
            groups: groups,
            member_count: count,
            online_count: onlineCount
        });
    },
    syncMemberList: async (guild: Guild, user_id: string) => {
        await global.dispatcher.dispatchEventInGuildToThoseSubscribedTo(guild, "LIST_RELOAD", async function (this: any) {
            let otherSession = this;
            let guildSubs = otherSession.subscriptions[guild.id];

            if (!guildSubs) return;

            for (let [channelId, subData] of Object.entries(guildSubs) as [string, any][]) {
                let channel = guild.channels.find(x => x.id === channelId);
                if (!channel) continue;

                let { items: newItems, groups, count } = lazyRequest.computeMemberList(guild, channel, subData.ranges || [[0, 99]]);
                let everyoneRole = guild.roles.find(x => x.id === guild.id)!;
                let listId = lazyRequest.getListId(otherSession, guild, channel, everyoneRole);
                let totalOnline = groups.filter(g => g.id !== "offline").reduce((acc, g) => acc + g.count, 0);

                let ops = [];

                if (global.config.sync_only) {
                    ops = subData.ranges.map((range: any) => {
                        return {
                            op: "SYNC",
                            range: range,
                            items: newItems.slice(range[0], range[1] + 1)
                        };
                    });
                } else {
                    let oldItems: MemberListItem[] = otherSession.memberListCache[channelId];

                    if (!oldItems) continue;

                    let oldIndex = oldItems.findIndex(item => isMember(item) && (item.member.id === user_id || item.member.user?.id === user_id));
                    let newIndex = newItems.findIndex(item => isMember(item) && (item.member.id === user_id || item.member.user?.id === user_id));

                    if (oldIndex !== newIndex) {
                        let indicesToDelete: number[] = [];
                        
                        if (oldIndex !== -1) {
                            indicesToDelete.push(oldIndex);

                            const prevOld = oldItems[oldIndex - 1];

                            if (oldIndex > 0 && prevOld && 'group' in prevOld && prevOld.group.count === 1) {
                                indicesToDelete.push(oldIndex - 1);
                            }
                        }

                        indicesToDelete.sort((a, b) => b - a).forEach(idx => ops.push({ op: "DELETE", index: idx }));

                        if (newIndex !== -1) {
                            const prevNew = newItems[newIndex - 1];

                            if (newIndex > 0 && prevNew && 'group' in prevNew && prevNew.group.count === 1) {
                                ops.push({ op: "INSERT", index: newIndex - 1, item: prevNew });
                            }

                            ops.push({ op: "INSERT", index: newIndex, item: newItems[newIndex] });
                        }
                    } else if (newIndex !== -1) {
                        ops.push({ op: "UPDATE", index: newIndex, item: newItems[newIndex] });
                    }
                }

                otherSession.memberListCache[channelId] = newItems;

                if (ops.length > 0) {
                    return {
                        guild_id: guild.id,
                        id: listId,
                        ops: ops,
                        groups: groups,
                        member_count: count,
                        online_count: totalOnline
                    };
                }
            }
        }, false, "GUILD_MEMBER_LIST_UPDATE");
    },
    fire: async (socket: GatewayClientSocket, packet: GatewayPacket) => {
        if (!socket.session) return;

        let { guild_id, channels, members: memberIds } = packet.d;

        if (!guild_id || !channels) return;

        let guild = socket.session.guilds.find((x: Guild) => x.id === guild_id);

        if (!guild) return;

        if (!socket.session.subscriptions[guild_id]) {
            socket.session.subscriptions[guild_id] = {};
        }

        for (let [channelId, ranges] of Object.entries(channels) as [string, any][]) {
            let channel = guild.channels.find((x: Channel) => x.id === channelId);

            if (!channel) continue;

            socket.session.subscriptions[guild_id][channelId] = {
                ranges: ranges
            };

            if (Array.isArray(memberIds)) {
                memberIds.forEach(id => {
                    let presence = globalUtils.getGuildPresences(guild).find(p => p.user.id === id); //cant trust guild.presences

                    if (presence) {
                        socket.session.dispatch("PRESENCE_UPDATE", {
                            ...presence,
                            guild_id: guild.id
                        });
                    }
                });
            }

            lazyRequest.handleMembersSync(socket.session, channel, guild, {
                ranges: ranges
            });
        }
    }
};

module.exports = lazyRequest;