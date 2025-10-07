import React from 'react';
import Member from './member';
import Paginator from './paginator';
import Channel from './channel';

import DefaultAvatar from '../../assets/default-avatar.png'

const Server = ({ data }) => {
    return (
        <>
            <div className='mainPage-main-components-sidebar'>
                <div className="mainPage-main-components-sidebar-guildAvatar">
                    <div className='guildAvatar avatar' style={{ 'backgroundImage': `url('${data.icon == null ? DefaultAvatar : 'http://localhost:1337/icons/' + data.id + '/' + data.icon + ".png"}` }}></div>
                </div>
                <div className='mainPage-main-components-sidebar-text'>{data.name}</div>
                <div className='mainPage-main-components-sidebar-buttons'>
                    <button>Edit Info</button>
                    <button>Clear Icon</button>
                    <button>Transfer Ownership</button>
                    <button>Add Member</button>
                    <button>Delete</button>
                </div>
                <div className='mainPage-main-components-sidebar-separator'></div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Server ID</div>
                    {data.id}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Server Since</div>
                    {new Date(data.creation_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric"})}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Member Count</div>
                    {data.members.length}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Invite Splash</div>
                    {data.splash_hash ?? 'NONE'}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Owner Id</div>
                    <a href={`/users/${data.owner_id}`}>{data.owner_id}</a>
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Application Id</div>
                    {data.application_id ?? 'NONE'}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Server Era</div>
                    {'Up to ' + data.region ?? 'Everything'}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Verification Level</div>
                    {data.verification_level === 3 ? 'HIGH' : (data.verification_level === 2 ? 'MEDIUM' : 'LOW') ?? 'NONE'}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Features</div>
                    {data.features == null ? 'NONE' : data.features.join(",")}
                </div>
                <div className='mainPage-main-components-sidebar-infoLine'>
                    <div className='mainPage-main-components-sidebar-label'>Default Message Notifications</div>
                    {data.default_message_notifications === 1 ? 'Only Mentions' : 'All Messages'}
                </div>
            </div>
            <div className='mainPage-main-components-main'>
                <div className='mainPage-main-components-wrapper'>
                    <Paginator header="Members" tabs={['Username', 'Discriminator']}>
                        {data.members.map((member, i) => (
                            <Member
                                key={i}
                                avatarHash={member.user.avatar == null ? DefaultAvatar : 'http://localhost:1337/avatars/' + member.user.id + '/' + member.user.avatar + '.png'}
                                username={member.user.username}
                                discriminator={member.user.discriminator}
                                id={member.user.id}
                            />
                        ))}
                    </Paginator>
                    <Paginator header="Channels" tabs={['Name', 'ID', 'Type', 'Position']}>
                        {data.channels.map((channel, i) => (
                            <Channel key={i} name={channel.name} id={channel.id} type={channel.type === 0 ? "Text" : "Voice"} position={channel.position}></Channel>
                        ))}
                    </Paginator>
                </div>
            </div>
        </>
    );
}


export default Server;