import { Navigate } from 'react-router-dom';
import Sidebar from './main/sidebar';
import Avatar from './main/avatar';
import { useAuthUser } from './context/AuthContext';
import DefaultAvatar from '../assets/default-avatar.png'

function AuthCheck({ appPage = null, enforced, minClearance }) {
    const { user } = useAuthUser();
    const avatarPath = (user && user.avatar) ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png` : DefaultAvatar;

    let AppPage = appPage;

    let authToken = localStorage.getItem('token');

    if (enforced && !authToken) {
        return <Navigate to="/login" />;
    }

    let user_data = JSON.parse(localStorage.getItem('user_data'));
    
    if (!user_data || !user_data.staff_details) {
        return <Navigate to="/login"/>;
    }

    if (!user_data.mfa_enabled && user_data.needs_mfa) {
        return <Navigate to="/mfa-notice"/>;
    }

    if (user_data.staff_details && user_data.staff_details.privilege < minClearance) {
        return <Navigate to="/"/>;
    }

    if (AppPage == null) {
        return (<>
            <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
                <div className='mainPage-container'>
                    <Sidebar></Sidebar>
                    <div className='mainPage-main'>
                        <div className='mainPage-main-header'>
                            <Avatar path={avatarPath} style={{
                                right: '20px',
                                position: 'absolute'
                            }}></Avatar>
                        </div>
                        <div className='mainPage-main-components'>
                        </div>
                    </div>
                </div>
            </div>
        </>)
    }

    return <AppPage/>;
}

export default AuthCheck;