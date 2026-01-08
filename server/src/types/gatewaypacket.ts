export interface GatewayPacket {
    op: number; 
    d: any;
    s?: number;
    t?: string;
};