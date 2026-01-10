import { useState, useEffect } from 'react';
import Sidebar from './sidebar';
import Avatar from './avatar';
import { useAuthUser } from '../context/AuthContext';
import Update from './update';

import DefaultAvatar from '../../assets/default-avatar.png';

const Updates = () => {
  const { user } = useAuthUser();
  const avatarPath =
    user && user.avatar
      ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png`
      : DefaultAvatar;

  const [updateStatus, setUpdateStatus] = useState('checking');
  const [latestCommit, setLatestCommit] = useState(null);
  const [error, setError] = useState(null);

  const currentCommitHash = import.meta.env.VITE_APP_GIT_COMMIT_HASH;
  const updateDisabled = import.meta.env.VITE_APP_DISABLE_UPDATE_CHECK;

  useEffect(() => {
    const checkForUpdates = async () => {
      if (updateDisabled) {
        setUpdateStatus('update-disabled');
        return;
      }

      try {
        const apiUrl = `https://api.github.com/repos/oldcordapp/OldcordV3/commits/main`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
          throw new Error(`Failed to fetch from GitHub API (Status: ${response.status})`);
        }

        const data = await response.json();
        const latestRemoteCommit = data;
        const latestRemoteHash = latestRemoteCommit.sha.substring(0, 7);

        setLatestCommit({
          sha: latestRemoteCommit.sha,
          message: latestRemoteCommit.commit.message.split('\n')[0],
          author: latestRemoteCommit.commit.author.name,
          date: latestRemoteCommit.commit.author.date,
        });

        if (currentCommitHash === latestRemoteHash) {
          setUpdateStatus('up-to-date');
        } else {
          setUpdateStatus('update-available');
        }
      } catch (err) {
        setError(err.message);
        setUpdateStatus('error');
      }
    };

    checkForUpdates();
  }, [currentCommitHash]);

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        <div className="mainPage-container">
          <Sidebar active="Updates" />
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
                <div className="mainPage-main-components-infoCard-header">Oldcord Update</div>
                <div className="mainPage-main-components-infoCard-components">
                  <Update status={updateStatus} error={error} latestCommit={latestCommit} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Updates;
