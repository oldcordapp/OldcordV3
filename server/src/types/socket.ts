import { WebSocket } from "ws";
import { GatewayHeartbeat } from "./gatewayheartbeat";

export interface GatewayClientProps {
    client_build_date?: Date;
    client_build?: string;
    identified?: boolean;
    session: any;
    user: any;
    hb?: GatewayHeartbeat;
    current_guild: any;
    inCall: boolean;
    wantsZlib: boolean;
    zlibHeader: boolean;
    wantsEtf: boolean;
    apiVersion: number;
    cookieStore: Record<string, string>;
}

export type GatewayClientSocket = WebSocket & GatewayClientProps;