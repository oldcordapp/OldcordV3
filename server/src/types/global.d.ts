import dispatcher from "../helpers/dispatcher";
import gateway from "../gateway";
import udpServer from "../udpserver";
import rtcServer from "../rtcserver";
import MediasoupSignalingDelegate from "../helpers/webrtc/MediasoupSignalingDelegate";
import emailer from "../helpers/emailer";
import database from "../helpers/database";
import permissionsM from "../helpers/permissions";
import { PermissionBits } from "../helpers/permissions";

declare global {
    var config: any;
    var gateway: any;
    var using_media_relay: boolean;
    var full_url: string;
    var protocol_url: string;
    var dispatcher: dispatcher;
    var slowmodeCache: Map<string, any>;
    var gatewayIntentMap: Map<string, any>;
    var udpServer: UdpServer;
    var rtcServer: RtcServer;
    var mediaserver: MediasoupSignalingDelegate;
    var emailer: Emailer;
    var sessions: Map<string, any>;
    var userSessions: Map<string, any>; 
    var database: Database;
    var permissions: permissionsM;
    var rooms: any[];
    var MEDIA_CODECS: any[];
    var guild_voice_states: Map<string, any>;
}

export {};