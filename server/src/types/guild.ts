
import { Channel } from "./channel";
import { Member } from "./member";
import { Role } from "./role";

export interface Guild {
    id: string;
    members: Member[];
    roles: Role[];
    channels: Channel[];
    owner_id: string;
}