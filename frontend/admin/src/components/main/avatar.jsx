import { useEffect,useRef, useState } from 'react';

import { useAuthUser } from '../context/AuthContext';
import Dropdown from './dropdown';

const Avatar = ({ path, style }) => {
  const [popoutContextMenu, setPopoutContextMenu] = useState(null);
  const dropdownRef = useRef(null);
  const { user } = useAuthUser();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setPopoutContextMenu(null);
      }
    };

    if (popoutContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [popoutContextMenu]);

  return (
    <>
      <div className="mainPage-main-header-avatar">
        <div
          className="mainPage-main-header-avatar-icon"
          style={{ ...style, backgroundImage: `url(${path})` }}
          onClick={() => {
            setPopoutContextMenu(
              popoutContextMenu
                ? null
                : [
                    {
                      name: `${user.username}#${user.discriminator}`,
                      not_implemented_yet: true,
                      action: () => {},
                    },
                    {
                      name: 'Logout',
                      not_implemented_yet: false,
                      action: () => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user_data');
                        location.reload();
                      },
                    },
                  ],
            );
          }}
        ></div>

        {popoutContextMenu !== null ? (
          <div
            className="mainPage-main-components-popouts-container"
            ref={dropdownRef}
            style={{
              top: '25px',
            }}
          >
            <div className="mainPage-main-popouts">
              <Dropdown
                contextMenu={popoutContextMenu}
                onClose={() => setPopoutContextMenu(null)}
              />
            </div>
          </div>
        ) : (
          <></>
        )}
      </div>
    </>
  );
};

export default Avatar;
