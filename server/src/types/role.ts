export interface Role {
    id: string;
    name: string;
    position: number;
    permissions: string | number | bigint;
    hoist: boolean;
}