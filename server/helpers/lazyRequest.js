import { murmur3 } from 'murmurhash-js';

import dispatcher from './dispatcher.js';
import globalUtils from './globalutils.js';

const lazyRequest = {
  getSortedList: (guild) => {
    return [...guild.members].sort((a, b) => {
      const pA = globalUtils.getUserPresence(a);
      const pB = globalUtils.getUserPresence(b);
      const statusA = pA?.status && pA.status !== 'offline' ? 1 : 0;
      const statusB = pB?.status && pB.status !== 'offline' ? 1 : 0;

      if (statusA !== statusB) return statusB - statusA;
      return a.user.username.localeCompare(b.user.username);
    });
  },
  getListId: (session, guild, channel, everyoneRole) => {
    if (!channel) {
      if (!session.subscriptions) {
        session.subscriptions = {};
      }

      session.subscriptions[guild.id] = {};

      return murmur3('', 0).toString();
    }

    const READ_MESSAGES = global.permissions.toObject().READ_MESSAGES;
    const everyoneOverwrite = channel.permission_overwrites.find((ov) => ov.id === everyoneRole.id);

    let everyoneCanView = everyoneRole.permissions & READ_MESSAGES;

    if (everyoneOverwrite && everyoneOverwrite.deny & READ_MESSAGES) {
      everyoneCanView = false;
    }

    const otherDenyRules = channel.permission_overwrites.some(
      (ov) => ov.id !== everyoneRole.id && ov.deny & READ_MESSAGES,
    );

    if (everyoneCanView && !otherDenyRules) {
      return 'everyone';
    }

    const perms = [];

    channel.permission_overwrites.forEach((overwrite) => {
      if (overwrite.allow & READ_MESSAGES) {
        perms.push(`allow:${overwrite.id}`);
      } else if (overwrite.deny & READ_MESSAGES) {
        perms.push(`deny:${overwrite.id}`);
      }
    });

    if (perms.length === 0) {
      return murmur3('', 0).toString();
    }

    return murmur3(perms.sort().join(','), 0).toString();
  },
  computeMemberList: (guild, channel, ranges, bypassPerms = false) => {
    function arrayPartition(array, callback) {
      return array.reduce(
        ([pass, fail], elem) => {
          return callback(elem) ? [[...pass, elem], fail] : [pass, [...fail, elem]];
        },
        [[], []],
      );
    }

    function formatMemberItem(member, forcedStatus = null) {
      const p = globalUtils.getUserPresence(member);
      if (forcedStatus != null) p.status = forcedStatus;

      return {
        member: {
          ...member,
          presence: p,
        },
      };
    }

    const visibleMembers = guild.members.filter((m) => {
      return (
        global.permissions.hasChannelPermissionTo(channel, guild, m.id, 'READ_MESSAGES') ||
        bypassPerms
      );
    });

    const sortedMembers = [...visibleMembers].sort((a, b) => {
      const pA = globalUtils.getUserPresence(a);
      const pB = globalUtils.getUserPresence(b);
      const statusA = pA?.status && pA.status !== 'offline' ? 1 : 0;
      const statusB = pB?.status && pB.status !== 'offline' ? 1 : 0;
      if (statusA !== statusB) return statusB - statusA;
      return a.user.username.localeCompare(b.user.username);
    });

    const allItems = [];
    const groups = [];
    const placedUserIds = new Set();
    let remainingMembers = [...sortedMembers];
    const hoistedRoles = (guild.roles || [])
      .filter((r) => r.hoist)
      .sort((a, b) => b.position - a.position);

    hoistedRoles.forEach((role) => {
      const [roleMembers, others] = arrayPartition(remainingMembers, (m) => {
        if (placedUserIds.has(m.user.id)) return false;

        const p = globalUtils.getUserPresence(m);

        return p && p.status !== 'offline' && m.roles.includes(role.id);
      });

      if (roleMembers.length > 0) {
        const group = { id: role.id, count: roleMembers.length };
        groups.push(group);
        allItems.push({ group });

        roleMembers.forEach((m) => {
          allItems.push(formatMemberItem(m));
          placedUserIds.add(m.user.id);
        });
      }

      remainingMembers = others;
    });

    const [onlineLeft, others] = arrayPartition(remainingMembers, (m) => {
      if (placedUserIds.has(m.user.id)) return false;

      const p = globalUtils.getUserPresence(m);
      return p && p.status !== 'offline' && p.status !== 'invisible';
    });

    if (onlineLeft.length > 0) {
      groups.push({ id: 'online', count: onlineLeft.length });
      allItems.push({ group: { id: 'online', count: onlineLeft.length } });

      onlineLeft.forEach((m) => {
        allItems.push(formatMemberItem(m));
        placedUserIds.add(m.user.id);
      });
    }

    remainingMembers = others;

    const offlineFinal = remainingMembers.filter((m) => !placedUserIds.has(m.user.id));

    if (offlineFinal.length > 0) {
      groups.push({ id: 'offline', count: offlineFinal.length });
      allItems.push({ group: { id: 'offline', count: offlineFinal.length } });

      offlineFinal.forEach((m) => {
        allItems.push(formatMemberItem(m, 'offline'));
        placedUserIds.add(m.user.id);
      });
    }

    const syncOps = ranges.map((range) => {
      const [startIndex, endIndex] = range;

      return {
        op: 'SYNC',
        range,
        items: allItems.slice(startIndex, endIndex + 1),
      };
    });

    return {
      ops: syncOps,
      groups: groups,
      items: allItems,
      count: visibleMembers.length,
    };
  },
  clearGuildSubscriptions: (session, guildId) => {
    if (session.subscriptions && session.subscriptions[guildId]) {
      delete session.subscriptions[guildId];
    }

    if (session.memberListCache) {
      for (const key in session.memberListCache) {
        if (key.startsWith(guildId) || key.includes(guildId)) {
          delete session.memberListCache[key];
        }
      }
    }
  },
  handleMemberRemove: async (session, guild, memberId) => {
    const guildSubs = session.subscriptions[guild.id];
    if (!guildSubs) return;

    const leaverSession = Array.from(global.sessions.values()).find((s) => s.user.id === memberId);
    if (leaverSession) {
      lazyRequest.clearGuildSubscriptions(leaverSession, guild.id);
    }

    for (const [channelId, subData] of Object.entries(guildSubs)) {
      const channel = guild.channels.find((x) => x.id === channelId);
      if (!channel) continue;

      const list_id = lazyRequest.getListId(
        session,
        guild,
        channel,
        guild.roles.find((x) => x.id === guild.id),
      );
      let ops = [];

      const oldItems = session.memberListCache[channelId];
      if (!oldItems) continue;

      const tempGuild = { ...guild, members: guild.members.filter((m) => m.id !== memberId) };
      const {
        items: newItems,
        groups,
        count,
      } = lazyRequest.computeMemberList(tempGuild, channel, subData.ranges);
      const totalOnline = groups
        .filter((g) => g.id !== 'offline')
        .reduce((acc, g) => acc + g.count, 0);

      if (global.config.sync_only) {
        ops = subData.ranges.map((range) => ({
          op: 'SYNC',
          range: range,
          items: newItems.slice(range[0], range[1] + 1),
        }));
      } else {
        const visualIndex = oldItems.findIndex(
          (i) => i.member && (i.member.id === memberId || i.member.user?.id === memberId),
        );
        if (visualIndex === -1) continue;

        ops.push({ op: 'DELETE', index: visualIndex });

        if (
          visualIndex > 0 &&
          oldItems[visualIndex - 1].group &&
          oldItems[visualIndex - 1].group.count === 1
        ) {
          ops.push({ op: 'DELETE', index: visualIndex - 1 });
        }
      }

      session.memberListCache[channelId] = newItems;

      session.dispatch('GUILD_MEMBER_LIST_UPDATE', {
        guild_id: guild.id,
        id: list_id,
        ops: ops,
        groups: groups,
        member_count: count,
        online_count: totalOnline,
      });
    }

    guild.members = guild.members.filter((m) => m.id !== memberId);
  },
  handleMemberAdd: async (session, guild, member) => {
    const guildSubs = session.subscriptions[guild.id];
    if (!guildSubs) return;

    const memberId = member.id || member.user?.id;

    if (!guild.members.find((m) => m.id === memberId)) {
      guild.members.push(member);
    }

    for (const [channelId, subData] of Object.entries(guildSubs)) {
      const channel = guild.channels.find((x) => x.id === channelId);
      if (!channel) continue;

      const {
        items: newItems,
        groups,
        count,
      } = lazyRequest.computeMemberList(guild, channel, subData.ranges);
      const list_id = lazyRequest.getListId(
        session,
        guild,
        channel,
        guild.roles.find((x) => x.id === guild.id),
      );
      const totalOnline = groups
        .filter((g) => g.id !== 'offline')
        .reduce((acc, g) => acc + g.count, 0);

      let ops = [];

      if (global.config.sync_only) {
        ops = subData.ranges.map((range) => ({
          op: 'SYNC',
          range: range,
          items: newItems.slice(range[0], range[1] + 1),
        }));
      } else {
        const oldItems = session.memberListCache[channelId] || [];
        const visualIndex = newItems.findIndex(
          (i) => i.member && String(i.member.id || i.member.user?.id) === String(memberId),
        );

        if (visualIndex !== -1) {
          if (visualIndex > 0 && newItems[visualIndex - 1].group) {
            const newGroup = newItems[visualIndex - 1].group;
            const oldGroupIdx = oldItems.findIndex((i) => i.group && i.group.id === newGroup.id);

            if (oldGroupIdx === -1) {
              ops.push({ op: 'INSERT', index: visualIndex - 1, item: newItems[visualIndex - 1] });
            } else {
              ops.push({ op: 'UPDATE', index: oldGroupIdx, item: newItems[visualIndex - 1] });
            }
          }
          ops.push({ op: 'INSERT', index: visualIndex, item: newItems[visualIndex] });
        }
      }

      session.memberListCache[channelId] = newItems;

      if (ops.length > 0) {
        session.dispatch('GUILD_MEMBER_LIST_UPDATE', {
          guild_id: guild.id,
          id: list_id,
          ops: ops,
          groups: groups,
          member_count: count,
          online_count: totalOnline,
        });
      }
    }
  },
  handleMembersSync: (session, channel, guild, subData) => {
    if (!subData || !subData.ranges) return;

    const list_id = lazyRequest.getListId(
      session,
      guild,
      channel,
      guild.roles.find((x) => x.id === guild.id),
    );

    const { ops, groups, items, count } = lazyRequest.computeMemberList(
      guild,
      channel,
      subData.ranges,
    );

    const onlineCount = groups
      .filter((g) => g.id === 'online' || guild.roles.some((r) => r.id === g.id && r.hoist))
      .reduce((acc, g) => acc + g.count, 0);

    if (!session.memberListCache) {
      session.memberListCache = {};
    } //kick causes that error

    session.memberListCache[channel.id] = items;

    session.dispatch('GUILD_MEMBER_LIST_UPDATE', {
      guild_id: guild.id,
      id: list_id,
      ops: ops,
      groups: groups,
      member_count: count,
      online_count: onlineCount,
    });
  },
  syncMemberList: async (guild, user_id) => {
    await dispatcher.dispatchEventInGuildToThoseSubscribedTo(
      guild,
      'LIST_RELOAD',
      async function () {
        const otherSession = this;
        const guildSubs = otherSession.subscriptions[guild.id];

        if (!guildSubs) return;

        for (const [channelId, subData] of Object.entries(guildSubs)) {
          const channel = guild.channels.find((x) => x.id === channelId);
          if (!channel) continue;

          const {
            items: newItems,
            groups,
            count,
          } = lazyRequest.computeMemberList(guild, channel, subData.ranges || [[0, 99]]);
          const listId = lazyRequest.getListId(
            otherSession,
            guild,
            channel,
            guild.roles.find((x) => x.id === guild.id),
          );
          const totalOnline = groups
            .filter((g) => g.id !== 'offline')
            .reduce((acc, g) => acc + g.count, 0);

          let ops = [];

          if (global.config.sync_only) {
            ops = subData.ranges.map((range) => {
              return {
                op: 'SYNC',
                range: range,
                items: newItems.slice(range[0], range[1] + 1),
              };
            });
          } else {
            const oldItems = otherSession.memberListCache[channelId];
            if (!oldItems) continue;

            const oldIndex = oldItems.findIndex(
              (item) =>
                item.member && (item.member.id === user_id || item.member.user?.id === user_id),
            );
            const newIndex = newItems.findIndex(
              (item) =>
                item.member && (item.member.id === user_id || item.member.user?.id === user_id),
            );

            if (oldIndex !== newIndex) {
              const indicesToDelete = [];
              if (oldIndex !== -1) {
                indicesToDelete.push(oldIndex);
                if (
                  oldIndex > 0 &&
                  oldItems[oldIndex - 1].group &&
                  oldItems[oldIndex - 1].group.count === 1
                ) {
                  indicesToDelete.push(oldIndex - 1);
                }
              }

              indicesToDelete
                .sort((a, b) => b - a)
                .forEach((idx) => ops.push({ op: 'DELETE', index: idx }));

              if (newIndex !== -1) {
                if (
                  newIndex > 0 &&
                  newItems[newIndex - 1].group &&
                  newItems[newIndex - 1].group.count === 1
                ) {
                  ops.push({ op: 'INSERT', index: newIndex - 1, item: newItems[newIndex - 1] });
                }
                ops.push({ op: 'INSERT', index: newIndex, item: newItems[newIndex] });
              }
            } else if (newIndex !== -1) {
              ops.push({ op: 'UPDATE', index: newIndex, item: newItems[newIndex] });
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
              online_count: totalOnline,
            };
          }
        }
      },
      false,
      'GUILD_MEMBER_LIST_UPDATE',
    );
  },
  fire: async (socket, packet) => {
    if (!socket.session) return;

    const { guild_id, channels, members: memberIds } = packet.d;

    if (!guild_id || !channels) return;

    const guild = socket.session.guilds.find((x) => x.id === guild_id);

    if (!guild) return;

    if (!socket.session.subscriptions[guild_id]) {
      socket.session.subscriptions[guild_id] = {};
    }

    for (const [channelId, ranges] of Object.entries(channels)) {
      const channel = guild.channels.find((x) => x.id === channelId);

      if (!channel) continue;

      socket.session.subscriptions[guild_id][channelId] = {
        ranges: ranges,
      };

      if (Array.isArray(memberIds)) {
        memberIds.forEach((id) => {
          const presence = globalUtils.getGuildPresences(guild).find((p) => p.user.id === id); //cant trust guild.presences

          if (presence) {
            socket.session.dispatch('PRESENCE_UPDATE', {
              ...presence,
              guild_id: guild.id,
            });
          }
        });
      }

      lazyRequest.handleMembersSync(socket.session, channel, guild, {
        ranges: ranges,
      });
    }
  },
};

export const {
  getSortedList,
  getListId,
  computeMemberList,
  clearGuildSubscriptions,
  handleMemberRemove,
  handleMemberAdd,
  handleMembersSync,
  syncMemberList,
  fire,
} = lazyRequest;

export default lazyRequest;
