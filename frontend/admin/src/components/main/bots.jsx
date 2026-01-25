import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

import DefaultAvatar from '../../assets/default-avatar.png';
import NoResults from '../../assets/img_noresults.svg';
import { useAuthUser } from '../context/AuthContext';
import Avatar from './avatar';
import Bot from './bot';
import Searchbar from './searchbar';
import Sidebar from './sidebar';
import User from './user';

const Bots = () => {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { user } = useAuthUser();
  const avatarPath =
    user && user.avatar
      ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png`
      : DefaultAvatar;

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const inputText = searchParams.get('searchInput');

    if (inputText) {
      fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/bots/${inputText}`, {
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
    }
  }, [location.search]);

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        <div className='mainPage-container'>
          <Sidebar active='Bots'></Sidebar>
          <div className='mainPage-main'>
            <div className='mainPage-main-header'>
              <div className='mainPage-main-header-components'>
                <Searchbar placeholder='Lookup a bot by ID' error={error}></Searchbar>
              </div>
              <Avatar path={avatarPath}></Avatar>
            </div>
            <div className='mainPage-main-components'>
              {data == null ? (
                <>
                  <div className='search-no-results'>
                    <img src={NoResults} alt='No Results Found'></img>
                    <p>No Results Found</p>
                  </div>
                </>
              ) : (
                <>
                  <Bot data={data} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Bots;
