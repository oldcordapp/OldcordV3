import React from "react";

import DefaultAvatar from '../../assets/default-avatar.png'

const ServerCard = ({ data }) => {
    const handleRedirect = () => {
        window.location.href = `/servers?searchInput=${data.id}`;
    };

    return (
        <div className={"server-card"}>
            <div className="server-card-details-wrapper">
                <div className="server-card-details-header">
                    <div className="server-card-details-img-and-text">
                        <img src={DefaultAvatar} alt="Server Avatar"></img>
                    </div>
                    <div className="server-card-details-text">
                        <h1>{data.name}</h1>
                        <p>{data.description ?? ''}</p>
                    </div>
                </div>
                <div className="server-card-details-footer">
                    <button onClick={handleRedirect}>Manage</button>
                    <span>{data.members.length} Member(s)</span>
                    <span>{data.channels.length} Channel(s)</span>
                    <span>{data.roles.length} Role(s)</span>
                    <span>{data.emojis.length} Emote(s)</span>
                </div>
            </div>
        </div>
    )
};

export default ServerCard;