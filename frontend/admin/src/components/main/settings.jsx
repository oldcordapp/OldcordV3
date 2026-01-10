import { useEffect,useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import DefaultAvatar from '../../assets/default-avatar.png';
import { useAuthUser } from '../context/AuthContext';
import InputSingle from '../modals/inputsingle';
import Avatar from './avatar';
import Sidebar from './sidebar';
import Update from './update';

const Settings = () => {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuthUser();
  const avatarPath =
    user && user.avatar
      ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png`
      : DefaultAvatar;

  useEffect(() => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/settings`, {
      headers: {
        Authorization: localStorage.getItem('token').replace(/"/g, ''),
        Cookie: 'release_date=october_5_2017;',
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.code >= 400) {
          setError(data.message);
        } else {
          if (Array.isArray(data) && data.length === 0) {
            setData(null);
          } else setData(data);
        }
      })
      .catch((error) => {
        setError(error.message);
      });
  }, []);

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        <div className="mainPage-container">
          <Sidebar active="Settings" />
          <div className="mainPage-main">
            <div className="mainPage-main-header">
              <Avatar
                path={avatarPath}
                style={{
                  right: '20px',
                  position: 'absolute',
                }}
              ></Avatar>
            </div>
            <div className="mainPage-main-components">
              <div className="mainPage-main-components-infoCard">
                <div className="mainPage-main-components-infoCard-header">Settings</div>
                <div
                  className="mainPage-main-components-infoCard-components"
                  style={{
                    flexDirection: 'column',
                    maxHeight: '800px',
                    overflowX: 'clip',
                    overflowY: 'auto',
                  }}
                >
                  <div className="mainPage-main-components-sidebar-infoLine pd2">
                    <div className="mainPage-main-components-sidebar-label">Token Secret</div>
                    <input
                      className="input-field"
                      maxLength={250}
                      required={false}
                      placeholder="391465..."
                      value={`hello`}
                      onChange={(e) => {}}
                    />
                  </div>
                  <div className="mainPage-main-components-sidebar-infoLine pd2">
                    <div className="mainPage-main-components-sidebar-label">Token Secret</div>
                    <input
                      className="input-field"
                      maxLength={250}
                      required={false}
                      placeholder="391465..."
                      value={`hello`}
                      onChange={(e) => {}}
                    />
                  </div>
                  <div className="mainPage-main-components-sidebar-infoLine pd2">
                    <div className="mainPage-main-components-sidebar-label">Token Secret</div>
                    <input
                      className="input-field"
                      maxLength={250}
                      required={false}
                      placeholder="391465..."
                      value={`hello`}
                      onChange={(e) => {}}
                    />
                  </div>
                  <div className="mainPage-main-components-sidebar-infoLine pd2">
                    <div className="mainPage-main-components-sidebar-label">Token Secret</div>
                    <input
                      className="input-field"
                      maxLength={250}
                      required={false}
                      placeholder="391465..."
                      value={`hello`}
                      onChange={(e) => {}}
                    />
                  </div>
                  <div className="mainPage-main-components-sidebar-infoLine pd2">
                    <div className="mainPage-main-components-sidebar-label">Token Secret</div>
                    <input
                      className="input-field"
                      maxLength={250}
                      required={false}
                      placeholder="391465..."
                      value={`hello`}
                      onChange={(e) => {}}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
