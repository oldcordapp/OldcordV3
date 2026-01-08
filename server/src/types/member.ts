export interface Member {
    id: string;
    user: { id: string; username: string };
    roles: string[];
    [key: string]: any;
}