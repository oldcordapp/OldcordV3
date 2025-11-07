import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './sidebar';
import Avatar from './avatar';
import { useAuthUser } from '../context/AuthContext';

import DefaultAvatar from '../../assets/default-avatar.png';

const Settings = () => {
    const location = useLocation();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const { user } = useAuthUser();
    const avatarPath = (user && user.avatar) ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png` : DefaultAvatar;

    useEffect(() => {
        
    }, []);

    return (
        <>
            <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
                <div className='mainPage-container'>
                    <Sidebar active="Settings" />
                    <div className='mainPage-main'>
                        <div className='mainPage-main-header'>
                            <Avatar path={avatarPath} style={{
                                right: '20px',
                                position: 'absolute'
                            }}></Avatar>
                        </div>
                        <div className='mainPage-main-components'>
                            <div className='mainPage-main-components-infoCard'>
                                <div className='mainPage-main-components-infoCard-header'>
                                    Settings
                                </div>
                                <div className='mainPage-main-components-infoCard-components'>
                                    
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Settings;