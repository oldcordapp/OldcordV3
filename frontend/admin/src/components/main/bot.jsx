import { useState, useRef, useEffect } from 'react';
import Member from './member';
import Paginator from './paginator';
import DefaultAvatar from '../../assets/default-avatar.png';
import Confirmation from '../modals/confirmation';
import Ic_dots from '../../assets/ic_dots.svg?react';
import Dropdown from './dropdown';
import InputSingle from '../modals/inputsingle';
import Relationship from './relationship';

const Bot = ({ data }) => {
  const [confirmation, setConfirmation] = useState(null);
  const [inputPopup, setInputPopup] = useState(null);
  const [applicationInfoOpen, setApplicationInfoOpen] = useState(false);
  const [popoutContextMenu, setPopoutContextMenu] = useState(null);
  const closeConfirmation = () => setConfirmation(null);
  const closeInputPopup = () => setInputPopup(null);
  const dropdownRef = useRef(null);

  let user_data = JSON.parse(localStorage.getItem('user_data'));

  const clearAvatar = () => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/bots/${data.id}`, {
      headers: {
        Authorization: localStorage.getItem('token').replace(/"/g, ''),
        'Content-Type': 'application/json',
        Cookie: 'release_date=october_5_2017;',
      },
      method: 'PATCH',
      body: JSON.stringify({
        avatar: null,
        name: data.name,
      }),
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        if (data.code > 400) {
          console.log('failed to clear avatar: ' + data);
        }

        location.reload();
      })
      .catch((error) => {
        console.log('failed to clear avatar: ' + error);
      });

    closeConfirmation();
  };

  const disableBot = (internal_reason) => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/users/${data.id}/moderate/disable`, {
      headers: {
        Authorization: localStorage.getItem('token').replace(/"/g, ''),
        'Content-Type': 'application/json',
        Cookie: 'release_date=october_5_2017;',
      },
      method: 'POST',
      body: JSON.stringify({
        disabled_until: 'FOREVER',
        internal_reason: internal_reason,
      }),
    })
      .then((response) => {
        location.reload();
        //return response.json();
        /*.then((data) => {
            if (data.code > 400) {
               console.log("failed to disable user: " + data);
            }
        })
            */
      })
      .catch((error) => {
        console.log('failed to disable user ' + error);
      });

    closeConfirmation();
  };

  const deleteBot = (internal_reason) => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/users/${data.id}/moderate/delete`, {
      headers: {
        Authorization: localStorage.getItem('token').replace(/"/g, ''),
        'Content-Type': 'application/json',
        Cookie: 'release_date=october_5_2017;',
      },
      method: 'POST',
      body: JSON.stringify({
        internal_reason: internal_reason,
      }),
    })
      .then(() => {
        location.reload();
      })
      .catch((error) => {
        console.log('failed to delete user ' + error);
      });

    closeConfirmation();
  };

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

  const menuActions = [
    { name: 'Edit Info', not_implemented_yet: true, action: () => {} },
    {
      name: 'Clear Avatar',
      not_implemented_yet: true,
      action: () =>
        setConfirmation({
          summary: `Are you sure you want to clear "${data.username}"'s avatar?`,
          onYes: clearAvatar,
        }),
    },
    {
      name: 'Disable',
      not_implemented_yet: user_data && user_data.id === data.id,
      action: () => {
        setInputPopup({
          summary: `Are you sure you want to disable "${data.username}"?`,
          fieldType: 'text',
          field: `Internal Reason`,
          showFieldSpan: false,
          cancelName: `No`,
          onComplete: (internal_reason) => {
            disableBot(internal_reason);
          }, //to-do add support for temporary disabling
          completeName: `Yes`,
        });
      },
    },
    {
      name: 'Delete',
      not_implemented_yet: user_data && user_data.id === data.id,
      action: () => {
        setInputPopup({
          summary: `Are you sure you want to delete "${data.username}"?`,
          fieldType: 'text',
          field: `Internal Reason`,
          showFieldSpan: false,
          cancelName: `No`,
          onComplete: (internal_reason) => {
            deleteBot(internal_reason);
          },
          completeName: `Yes`,
        });
      },
    },
  ];

  return (
    <>
      <div className="mainPage-main-components-sidebar">
        <Ic_dots
          style={{
            width: '12px',
            height: '12px',
            color: 'gray',
            position: 'absolute',
            right: '10px',
            top: '10px',
            cursor: 'pointer',
          }}
          onClick={() => {
            setPopoutContextMenu(popoutContextMenu ? null : menuActions);
          }}
        />
        {popoutContextMenu !== null ? (
          <div className="mainPage-main-components-popouts-container" ref={dropdownRef}>
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
        <div className="mainPage-main-components-sidebar-guildAvatar">
          <div
            className="guildAvatar avatar"
            style={{
              backgroundImage: `url('${data.avatar == null ? DefaultAvatar : `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/` + data.id + '/' + data.avatar + '.png'}`,
            }}
          ></div>
        </div>
        <div className="mainPage-main-components-sidebar-text">
          {data.username}
          <span
            style={{
              color: '#9099a4',
              fontSize: '17px',
            }}
          >
            #{data.discriminator}
          </span>
        </div>
        <div className="mainPage-main-components-sidebar-separator"></div>
        <div className="mainPage-main-components-sidebar-infoLine">
          <div className="mainPage-main-components-sidebar-label">User ID</div>
          {data.application.id}
        </div>
        <div
          className="subsection-sidebar-info"
          style={{
            '--subsection-header': `"Application Info"`,
            '--subsection-status-symbol': `"${applicationInfoOpen ? '▲' : '▼'}"`,
          }}
          onClick={() => setApplicationInfoOpen(!applicationInfoOpen)}
        >
          {applicationInfoOpen ? (
            <>
              <div
                className="mainPage-main-components-sidebar-infoLine"
                style={{
                  marginTop: '10px',
                }}
              >
                <div className="mainPage-main-components-sidebar-label">ID</div>
                {data.application.id}
              </div>
              <div className="mainPage-main-components-sidebar-infoLine">
                <div className="mainPage-main-components-sidebar-label">Name</div>
                {data.application.name}
              </div>
              <div className="mainPage-main-components-sidebar-infoLine">
                <div className="mainPage-main-components-sidebar-label">Description</div>
                {data.application.description === '' || data.application.description === null
                  ? 'NONE'
                  : data.application.description}
              </div>
              <div className="mainPage-main-components-sidebar-infoLine">
                <div className="mainPage-main-components-sidebar-label">Owner</div>
                <a href={`/admin/users?searchInput=${data.application.owner.id}`}>
                  {data.application.owner.username}#{data.application.owner.discriminator}
                </a>
              </div>
            </>
          ) : (
            <></>
          )}
        </div>
        <div className="mainPage-main-components-sidebar-infoLine">
          <div className="mainPage-main-components-sidebar-label">Server Count</div>
          {data.guilds.length}
        </div>
        <div className="mainPage-main-components-sidebar-infoLine">
          <div className="mainPage-main-components-sidebar-label">Is Public?</div>
          {data.public === true ? 'Yes' : 'No'}
        </div>
        <div className="mainPage-main-components-sidebar-infoLine">
          <div className="mainPage-main-components-sidebar-label">Requires Code Grant?</div>
          {data.require_code_grant === true ? 'Yes' : 'No'}
        </div>
        <div className="mainPage-main-components-sidebar-infoLine">
          <div className="mainPage-main-components-sidebar-label">Flags</div>
          {data.flags || 0}
        </div>
      </div>
      <div className="mainPage-main-components-main">
        <div className="mainPage-main-components-wrapper">
          {data.guilds && Array.isArray(data.guilds) && data.guilds.length > 0 ? (
            <>
              <Paginator header="Servers" tabs={['Name', 'Id']}>
                {data.guilds.map((guild, i) => (
                  <Member
                    key={i}
                    avatarHash={
                      guild.icon == null
                        ? DefaultAvatar
                        : `${window.ADMIN_ENV.BASE_ENDPOINT}/icons/` +
                          guild.id +
                          '/' +
                          guild.icon +
                          '.png'
                    }
                    username={guild.name}
                    discriminator={guild.id}
                    id={guild.id}
                    actuallyServer={true}
                  />
                ))}
              </Paginator>
            </>
          ) : (
            <></>
          )}
        </div>
      </div>

      {confirmation != null && (
        <div id="overlay">
          <Confirmation
            onYes={confirmation.onYes}
            onNo={closeConfirmation}
            summary={confirmation.summary}
          />
        </div>
      )}

      {inputPopup != null && (
        <div id="overlay">
          <InputSingle
            summary={inputPopup.summary}
            fieldType={inputPopup.fieldType}
            field={inputPopup.field}
            onCancel={closeInputPopup}
            cancelName={inputPopup.cancelName}
            onComplete={inputPopup.onComplete}
            completeName={inputPopup.completeName}
          />
        </div>
      )}
    </>
  );
};

export default Bot;
