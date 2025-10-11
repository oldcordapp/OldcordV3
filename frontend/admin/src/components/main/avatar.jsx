import React from 'react';

const Avatar = ({ path, style }) => {
    return (
        <div className='mainPage-main-header-avatar'>
            <div className='mainPage-main-header-avatar-icon' style={{ ...style, 'backgroundImage': `url(${path})` }}>
            </div>
        </div>
    );
};

export default Avatar;