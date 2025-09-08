export const QOL_PATCHES = {
    electron: {
        id: 'electronPatch',
        label: 'Electron Patches',
        description: 'Required for client functionality. Automatically enabled on desktop client.',
        mandatory: false,
        defaultEnabled: false,
        compatibleVersions: 'all'
    },
    userSelect: {
        id: 'userSelect',
        label: 'User Select',
        description: 'Enables user selection in 2015 clients',
        mandatory: false,
        defaultEnabled: true,
        compatibleVersions: '2015'
    },
    emojiAnywhere: {
        id: 'emojiAnywhere',
        label: 'Unrestricted Emojis',
        description: 'Allows using emojis anywhere without restrictions',
        mandatory: false,
        defaultEnabled: true,
        compatibleVersions: 'all'
    },
    forceWebRtcFullSdp: {
        id: 'forceWebRtcFullSdp',
        label: 'Force WebRTC Full SDP',
        description: 'Forces the client to send a non truncated sdp upon Select Protocol (Only use if you know what you are doing)',
        mandatory: false,
        defaultEnabled: false,
        compatibleVersions: '2017'
    },
    forceWebRtcP2P: {
        id: 'forceWebRtcP2P',
        label: 'Force WebRTC P2P',
        description: 'Forces the client to use webrtc-p2p instead of webrtc, this means, small-scale voice calling without the need for a media server',
        mandatory: false,
        defaultEnabled: true,
        compatibleVersions: [
            "january_31_2017",
            "march_30_2017",
            "may_3_2017",
            "may_17_2017",
            "july_20_2017",
            "august_17_2017",
            "september_28_2017",
            "october_5_2017",
            "november_16_2017",
            "december_21_2017",
            "january_25_2018",
            "march_7_2018",
            "april_1_2018",
            "april_23_2018",
            "may_28_2018",
            "june_29_2018",
            "august_28_2018",
            "september_29_2018",
            "november_30_2018",
            "december_31_2018"
         ]
    }
};