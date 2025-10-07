import React from 'react';
import Sidebar from './sidebar';
import Avatar from './avatar';

const Main = () => {
    return (
        <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
            <div className='mainPage-container'>
                <Sidebar></Sidebar>
                <div className='mainPage-main'>
                    <div className='mainPage-main-header'>
                        <div className='mainPage-main-header-components'></div>
                        <Avatar path="/assets/default-avatar.png"></Avatar>
                    </div>
                </div>
            </div>
        </div>
    )
}


export default Main;