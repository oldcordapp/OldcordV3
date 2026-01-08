export interface Channel {
    id: string;
    type: number;
    guild_id?: string;
    permission_overwrites: any[];
}