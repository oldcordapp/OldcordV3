import React, {useState} from 'react';
import Member from './member';
import Paginator from './paginator';
import Channel from './channel';
import DefaultAvatar from '../../assets/default-avatar.png'
import Confirmation from '../modals/confirmation';

const Server = ({ data }) => {
    const [confirmation, setConfirmation] = useState(null);
    const closeConfirmation = () => setConfirmation(null);

    const clearIcon = () => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/guilds/${data.id}`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Content-Type' : 'application/json',
                'Cookie': 'release_date=december_22_2016;',
            },
            method: "PATCH",
            body: JSON.stringify({
                icon: null,
                name: data.name
            })
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code > 400) {
               console.log("failed to clear guild icon: " + data);
            }

            location.reload();

        }).catch((error) => {
            console.log("failed to clear guild icon: " + error);
        });

        closeConfirmation();
    };

    const deleteGuild = () => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/guilds/${data.id}/delete`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Content-Type' : 'application/json',
                'Cookie': 'release_date=december_22_2016;',
            },
            method: "POST",
            body: JSON.stringify({})
        }).then(() => {
            location.reload();
        }).catch((error) => {
            console.log("failed to delete guild " + error);
        });

        closeConfirmation();
    };

    return (
        <>
            <div className='mainPage-main-components-sidebar'>
                <div className="mainPage-main-components-sidebar-guildAvatar">
                    <div className='guildAvatar avatar' style={{ 'backgroundImage': `url('${data.icon == null ? DefaultAvatar : `${window.ADMIN_ENV.BASE_ENDPOINT}/icons/` + data.id + '/' + data.icon + ".png"}` }}></div>
                </div>
                <div className='mainPage-main-components-sidebar-text'>{data.name}</div>
                <div className='mainPage-main-components-sidebar-buttons'>
                    <button>Edit Info</button>
                    <button onClick={() => {
                        setConfirmation({
                            summary: `Are you sure you want to clear "${data.name}"'s icon?`,
                            onYes: clearIcon
                        })
                    }}>Clear Icon</button>
                    <button>Transfer Ownership</button>
                    <button>Add Member</button>
                    <button onClick={() => {
                        setConfirmation({
                            summary: `Are you sure you want to delete "${data.name}"?`,
                            onYes: deleteGuild
                        })
                    }}>Delete</button>
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
                    {(data.features == null || data.features.length === 0) ? 'NONE' : data.features.join(",")}
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
                                avatarHash={member.user.avatar == null ? DefaultAvatar : `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/` + member.user.id + '/' + member.user.avatar + '.png'}
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

            {confirmation != null && (
                <div id="overlay">
                    <Confirmation onYes={confirmation.onYes} onNo={closeConfirmation} summary={confirmation.summary} />
                </div>
            )}

        </>
    );
}


export default Server;