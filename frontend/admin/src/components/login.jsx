import { useNavigate } from 'react-router-dom';

import LoginSplash from '../assets/login_splash.png'
import DefaultAvatar from '../assets/default-avatar.png'
import OldcordLogo from '../assets/img_oldcord_logo.svg'

const Login = () => {
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    navigate('/');
  };
  
  return (
    <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
      <div className='loginPage-container' style={{ 'backgroundImage': `url('${LoginSplash}')` }}>
        <div className='admin-logo'>
          <img src={OldcordLogo} alt="Oldcord Logo" style={{fill: "#1f6ad3"}}/>
        </div>
        <form onSubmit={handleSubmit}>
          <div className='loginPage-card'>
            <div className='loginPage-card-contents'>
              <div className='loginPage-account avatar' style={{ 'backgroundImage': `url('${DefaultAvatar}')` }}></div>
              <div className='loginPage-card-text'>Login to the admin panel with your Oldcord instance staff account.</div>
            </div>
            <button className='loginPage-submit-button' onClick={() => {
              location.href = `/login?redirect_to=%2Fadmin`
            }}>SIGN IN WITH OLDCORD</button> {/* Add type="submit" */}
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;