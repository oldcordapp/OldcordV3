import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Sidebar from './sidebar';
import Avatar from './avatar';
import Paginator from './paginator';
import DefaultAvatar from '../../assets/default-avatar.png';
import NoResults from '../../assets/img_noresults.svg';
import Ic_dots from '../../assets/ic_dots.svg?react';
import Ic_paperclip from '../../assets/ic_paperclip.svg?react';
import Button from '@oldcord/frontend-shared/components/button';
import { useAuthUser } from '../context/AuthContext';
import ExpandableComponent from './expandablecomponent';
import ResultsCard from './resultscard';
import Dropdown from './dropdown';

const Messages = () => {
  const location = useLocation();
  const [data, setData] = useState([]); //messages
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [popoutContextMenu, setPopoutContextMenu] = useState(null);
  const dropdownRef = useRef(null);
  const selectedMessageRef = useRef(null);
  const [cdnLink, setCdnLink] = useState(null);
  const [context, setContext] = useState(null);
  const [messageId, setMessageId] = useState(null);
  const [channelId, setChannelId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [inputPopup, setInputPopup] = useState(null);
  const closeConfirmation = () => setConfirmation(null);
  const closeInputPopup = () => setInputPopup(null);
  const [popoutPosition, setPopoutPosition] = useState({ x: 0, y: 0 });
  const query = new URLSearchParams(location.search);
  const msgId = query.get('messageid');
  const chanId = query.get('channelid');
  const cdnlin = query.get('cdnlink');
  const contxt = query.get('context');
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const avatarPath =
    user && user.avatar
      ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png`
      : DefaultAvatar;

  useEffect(() => {
    if (chanId || msgId || cdnlin) {
      const params = new URLSearchParams();

      if (chanId) params.append('channelId', chanId);
      if (msgId) params.append('messageId', msgId);
      if (contxt) params.append('context', contxt);
      if (cdnlin) params.append('cdnLink', cdnlin);

      const url = `${window.ADMIN_ENV.API_ENDPOINT}/admin/messages?${params.toString()}`;

      setChannelId(chanId || '');
      setMessageId(msgId || '');
      setCdnLink(cdnlin || '');
      setContext(contxt || '');

      fetch(url, {
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
            setData([]);
          } else {
            setData(data);

            const targetMessage = data.find((m) => m.id === msgId);
            if (targetMessage) {
              setSelectedMessage(targetMessage);
            }
          }
        })
        .catch((error) => {
          setError(error.message);
          setData([]);
        });
    } else {
      setData([]);
      setError(null);
      setChannelId('');
      setMessageId('');
      setCdnLink('');
      setContext('');
    }
  }, [chanId, msgId, cdnlin, contxt]);

  useEffect(() => {
    if (data.length > 0 && selectedMessageRef.current) {
      selectedMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [data, msgId]);

  const searchMsgID = () => {
    const newParams = new URLSearchParams();

    if (channelId) newParams.append('channelid', channelId);
    if (messageId) newParams.append('messageid', messageId);
    if (context) newParams.append('context', context);
    if (cdnLink) newParams.append('cdnlink', cdnLink);

    const newSearchString = newParams.toString();
    const currentSearchString = location.search.substring(1);

    if (newSearchString === currentSearchString) {
      return;
    }

    setData([]);
    setSelectedMessage(null);
    setError(null);

    navigate(`?${newSearchString}`);
  };

  const searchCdnLink = () => {
    const newParams = new URLSearchParams();

    if (cdnLink) newParams.append('cdnlink', cdnLink);
    if (context) newParams.append('context', context);

    const newSearchString = newParams.toString();
    const currentSearchString = location.search.substring(1);

    if (newSearchString === currentSearchString) {
      return;
    }

    setData([]);
    setSelectedMessage(null);
    setError(null);

    navigate(`?${newSearchString}`);
  };

  const deleteMessage = (message) => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/messages/${message.id}`, {
      headers: {
        Authorization: localStorage.getItem('token').replace(/"/g, ''),
        Cookie: 'release_date=october_5_2017;',
      },
      method: 'DELETE',
    })
      .then(() => {
        setData(data.filter((x) => x.id !== message.id));

        if (selectedMessage && selectedMessage.id === message.id) {
          setSelectedMessage(null);
        }
      })
      .catch((error) => {
        setError(error.message);
      });
  };

  useEffect(() => {
    if (data.length > 0 && selectedMessageRef.current) {
      selectedMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [data, msgId]);

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        <div className="mainPage-container">
          <Sidebar active="Messages"></Sidebar>
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
              <>
                <>
                  <div
                    className="mainPage-main-components-sidebar"
                    style={{
                      padding: '0',
                    }}
                  >
                    <ExpandableComponent
                      id="search-by-cdn-link"
                      header="Search by CDN Link"
                      defaultOpened={false}
                    >
                      <div className="mainPage-main-components-sidebar-infoLine pd2">
                        <div className="mainPage-main-components-sidebar-label bold">Cdn Link</div>
                        <input
                          className="input-field"
                          maxLength={250}
                          required={false}
                          placeholder="https://example.com/attachments/..."
                          value={cdnLink}
                          onChange={(e) => setCdnLink(e.target.value)}
                        />
                      </div>
                      <div className="mainPage-main-components-sidebar-infoLine pd2">
                        <div className="mainPage-main-components-sidebar-label bold">Context</div>
                        <input
                          className="input-field"
                          maxLength={250}
                          required={false}
                          placeholder="Optional"
                          value={context}
                          onChange={(e) => setContext(e.target.value)}
                        />
                      </div>
                      <div
                        className="mainPage-main-components-sidebar-infoLine pd2"
                        style={{
                          textAlign: 'right',
                        }}
                      >
                        <Button
                          variant="primary"
                          onClick={() => searchCdnLink()}
                          style={{
                            width: '80px',
                            height: '35px',
                            fontSize: '13px',
                            marginTop: '-20px',
                          }}
                        >
                          Search
                        </Button>
                      </div>
                    </ExpandableComponent>
                    <ExpandableComponent
                      id="search-by-message-id"
                      header="Search by Message ID"
                      defaultOpened={true}
                    >
                      <div className="mainPage-main-components-sidebar-infoLine pd2">
                        <div className="mainPage-main-components-sidebar-label bold">
                          Message ID
                        </div>
                        <input
                          className="input-field"
                          maxLength={250}
                          required={false}
                          placeholder="391465..."
                          value={messageId}
                          onChange={(e) => setMessageId(e.target.value)}
                        />
                      </div>
                      <div className="mainPage-main-components-sidebar-infoLine pd2">
                        <div className="mainPage-main-components-sidebar-label bold">
                          Channel ID
                        </div>
                        <input
                          className="input-field"
                          maxLength={250}
                          required={false}
                          placeholder="231661..."
                          value={channelId}
                          onChange={(e) => setChannelId(e.target.value)}
                        />
                      </div>
                      <div className="mainPage-main-components-sidebar-infoLine pd2 bold">
                        <div className="mainPage-main-components-sidebar-label bold">Context</div>
                        <input
                          className="input-field"
                          maxLength={250}
                          required={false}
                          placeholder="Optional"
                          value={context}
                          onChange={(e) => setContext(e.target.value)}
                        />
                      </div>
                      <div
                        className="mainPage-main-components-sidebar-infoLine pd2"
                        style={{
                          textAlign: 'right',
                        }}
                      >
                        <Button
                          variant="primary"
                          onClick={() => searchMsgID()}
                          style={{
                            width: '80px',
                            height: '35px',
                            fontSize: '13px',
                            marginTop: '-20px',
                          }}
                        >
                          Search
                        </Button>
                      </div>
                    </ExpandableComponent>
                  </div>
                  <ResultsCard header="Message Results">
                    {data.length === 0 ? (
                      <>
                        <div className="search-no-results">
                          <img
                            src={NoResults}
                            alt="No data yet, try to search by CDN link or message ID."
                            style={{
                              width: 'auto',
                            }}
                          ></img>
                          <p>No data yet, try to search by CDN link or message ID.</p>
                        </div>
                      </>
                    ) : (
                      <>
                        {data.map((message, i) => (
                          <div
                            ref={msgId === message.id ? selectedMessageRef : null}
                            className={`message-result-container ${(selectedMessage && selectedMessage.id === message.id) || (messageId && messageId === message.id && !selectedMessage) ? 'selected-message' : ''}`}
                            key={message.id}
                            onClick={() => setSelectedMessage(message)}
                          >
                            {message.author.id !== '456226577798135808' &&
                            message.author.username !== 'Deleted User' ? (
                              <>
                                <img
                                  src={
                                    message.author.avatar == null
                                      ? DefaultAvatar
                                      : `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/` +
                                        message.author.id +
                                        '/' +
                                        message.author.avatar +
                                        '.png'
                                  }
                                  alt={`${message.author.username}'s avatar`}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    marginRight: '15px',
                                    cursor: 'pointer',
                                  }}
                                  className="message-result-avatar"
                                  onClick={() =>
                                    navigate(`/users?searchInput=${message.author.id}`)
                                  }
                                />
                              </>
                            ) : (
                              <>
                                <img
                                  src={
                                    message.author.avatar == null
                                      ? DefaultAvatar
                                      : `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/` +
                                        message.author.id +
                                        '/' +
                                        message.author.avatar +
                                        '.png'
                                  }
                                  alt={`${message.author.username}'s avatar`}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    marginRight: '15px',
                                  }}
                                />
                              </>
                            )}
                            <div className="message-result-body">
                              <div className="message-header-details">
                                {message.author.id !== '456226577798135808' &&
                                message.author.username !== 'Deleted User' ? (
                                  <>
                                    <h1
                                      style={{
                                        cursor: 'pointer',
                                      }}
                                      className="message-result-username"
                                      onClick={() =>
                                        navigate(`/users?searchInput=${message.author.id}`)
                                      }
                                    >
                                      {message.author.username}
                                    </h1>
                                  </>
                                ) : (
                                  <>
                                    <h1>{message.author.username}</h1>
                                  </>
                                )}
                                <span>
                                  {new Date().toLocaleDateString()} at{' '}
                                  {new Date().toLocaleTimeString('en-AU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              <h1 title={message.content.length > 175 ? message.content : ''}>
                                {message.content.length > 175
                                  ? message.content.substring(0, 175) + '...'
                                  : message.content}
                              </h1>
                              {message.attachments.length > 0 && (
                                <div className="message-result-attachments">
                                  <span>
                                    {message.attachments.length}{' '}
                                    {message.attachments.length == 1 ? 'Attachment' : 'Attachments'}
                                    :
                                  </span>
                                  <div className="message-attachments">
                                    {message.attachments.map((attachment) => (
                                      <div
                                        className="attachment-detail"
                                        key={attachment.id}
                                        title="Click to copy URL"
                                        onClick={() => {
                                          navigator.clipboard.writeText(attachment.url); //dont open it automatically as it could be illegal content & now it's cached on their browser
                                        }}
                                      >
                                        <Ic_paperclip /> <span>{attachment.filename}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="message-actions">
                              <Ic_dots
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  color: '#d8d8d8',
                                  cursor: 'pointer',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();

                                  setPopoutPosition({
                                    x: e.clientX,
                                    y: e.clientY,
                                  });

                                  setPopoutContextMenu(
                                    popoutContextMenu
                                      ? null
                                      : [
                                          {
                                            name: 'Copy Message',
                                            not_implemented_yet: false,
                                            action: () => {
                                              navigator.clipboard.writeText(message.content);
                                            },
                                          },
                                          {
                                            name: 'Copy Message ID',
                                            not_implemented_yet: false,
                                            action: () => {
                                              navigator.clipboard.writeText(message.id);
                                            },
                                          },
                                          {
                                            name: 'Copy Author ID',
                                            not_implemented_yet: false,
                                            action: () => {
                                              navigator.clipboard.writeText(message.author.id);
                                            },
                                          },
                                          {
                                            name: 'Delete Message',
                                            not_implemented_yet: false,
                                            action: () => {
                                              deleteMessage(message);
                                            },
                                          },
                                        ],
                                  );
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        {popoutContextMenu !== null ? (
                          <div
                            className="mainPage-main-components-popouts-container"
                            ref={dropdownRef}
                            style={{
                              top: popoutPosition.y,
                              left: popoutPosition.x,
                              position: 'fixed',
                              right: 'auto',
                              height: 'auto',
                              width: 'auto',
                            }}
                          >
                            <div
                              className="mainPage-main-popouts"
                              style={{
                                transform: 'translate(-10px, 0)',
                                top: '0',
                                right: '0',
                              }}
                            >
                              <Dropdown
                                contextMenu={popoutContextMenu}
                                onClose={() => {
                                  setPopoutContextMenu(null);
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <></>
                        )}
                      </>
                    )}
                  </ResultsCard>
                </>
                {confirmation != null && (
                  <div id="overlay">
                    <Confirmation
                      onYes={confirmation.onYes}
                      onNo={closeConfirmation}
                      summary={confirmation.summary}
                    />
                  </div>
                )}
              </>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Messages;
