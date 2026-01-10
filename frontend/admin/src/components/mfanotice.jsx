import { useNavigate } from 'react-router-dom';

import LoginSplash from '../assets/login_splash.png';
import DefaultAvatar from '../assets/default-avatar.png';
import OldcordLogo from '../assets/img_oldcord_logo.svg';

const MfaNotice = () => {
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();

    navigate('/');
  };

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: '100vh', transform: 'scale(1.15)' }}>
      <div className="loginPage-container" style={{ backgroundImage: `url('${LoginSplash}')` }}>
        <div className="admin-logo">
          <img
            src={OldcordLogo}
            alt="Oldcord Logo"
            style={{ fill: '#1f6ad3', width: '225px', marginBottom: '15px' }}
          />
        </div>
        <form onSubmit={handleSubmit}>
          <div
            className="loginPage-card"
            style={{
              textAlign: 'center',
              overflow: 'hidden',
              boxShadow: 'none ',
              width: 'auto',
            }}
          >
            <div
              className="loginPage-card-contents no-mfa"
              style={{
                paddingBottom: 'none',
                paddingTop: 'none',
                backgroundColor: 'transparent',
                color: '#fff',
                fontSize: '16px',
                fontWeight: '600',
                marginTop: '-10px',
              }}
            >
              <h1
                style={{
                  marginTop: '-20px',
                  borderBottom: '1px solid #a41313',
                  padding: '10px',
                  background: '#d94e4e',
                }}
              >
                YOU HAVE BEEN BLOCKED FROM PROCEEDING
              </h1>
              <div
                className="loginPage-card-text"
                style={{
                  color: 'rgba(0, 0, 0, 0.73)',
                  marginTop: '-22px',
                  wordBreak: 'break-word',
                  border: '1px solid #e38686',
                  background: '#ffe2e2',
                  padding: '15px',
                }}
              >
                <p>
                  This instance requires MFA to be enabled for every staff user regardless of
                  privilege. Please configure it on your Oldcord account and try visiting the admin
                  panel again when ready.
                </p>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MfaNotice;
