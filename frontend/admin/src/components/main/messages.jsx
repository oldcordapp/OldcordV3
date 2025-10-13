import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Sidebar from './sidebar';
import Avatar from './avatar';
import Paginator from './paginator';
import DefaultAvatar from '../../assets/default-avatar.png'
import NoResults from '../../assets/img_noresults.svg'
import Ic_dots from '../../assets/ic_dots.svg?react';
import Ic_paperclip from '../../assets/ic_paperclip.svg?react';
import Button from '@oldcord/frontend-shared/components/button';
import { useAuthUser } from '../..';
import ExpandableComponent from './expandablecomponent';
import ResultsCard from './resultscard';
import Dropdown from './dropdown';

const Messages = () => {
    const location = useLocation();
    const [data, setData] = useState([]); //messages
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [popoutContextMenu, setPopoutContextMenu] = useState(null);
    const dropdownRef = useRef(null);
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
    const avatarPath = (user && user.avatar) ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png` : DefaultAvatar;

    useEffect(() => {
        if (!chanId || !msgId) {
            return;
        } else if (!chanId && !msgId && !cdnlin) {
            return;
        }

        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/messages?channelId=${chanId}&messageId=${msgId}&context=${contxt}&cdnLink=${cdnlin}`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
            },
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code >= 400) {
                setError(data.message);
            } else {
                setData(data);
            }
        }).catch((error) => {
            setError(error.message);
        });
    }, []);

    const searchMsgID = () => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/messages?channelId=${channelId}&messageId=${messageId}&context=${context}&cdnLink=${cdnLink}`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
            },
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code >= 400) {
                setError(data.message);
            } else {
                setData(data);
            }
        }).catch((error) => {
            setError(error.message);
        });
    };

    const searchCdnLink = () => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/messages?channelId=${channelId}&messageId=${messageId}&context=${context}&cdnLink=${cdnLink}`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
            },
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code >= 400) {
                setError(data.message);
            } else {
                setData(data);
            }
        }).catch((error) => {
            setError(error.message);
        });
    };

    const deleteMessage = (message) => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/messages/${message.id}`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
            },
            method: "DELETE"
        }).then(() => {
            setData(data.filter(x => x.id !== message.id));

            if (selectedMessage && selectedMessage.id === message.id) {
                setSelectedMessage(null);
            }
        }).catch((error) => {
            setError(error.message);
        });
    };

    return (
        <>
            <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
                <div className='mainPage-container'>
                    <Sidebar active="Messages"></Sidebar>
                    <div className='mainPage-main'>
                        <div className='mainPage-main-header'>
                            <Avatar path={avatarPath} style={{
                                right: '20px',
                                position: 'absolute'
                            }}></Avatar>
                        </div>
                        <div className='mainPage-main-components'>
                            <>
                               <>
                                    <div className='mainPage-main-components-sidebar' style={{
                                        padding: '0'
                                    }}>
                                        <ExpandableComponent id="search-by-cdn-link" header="Search by CDN Link" defaultOpened={false}>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2'>
                                                <div className='mainPage-main-components-sidebar-label bold'>Cdn Link</div>
                                                <input className="input-field" maxLength={250} required={false} placeholder="https://example.com/attachments/..." value={cdnLink} onChange={(e) => setCdnLink(e.target.value)}/>
                                            </div>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2'>
                                                <div className='mainPage-main-components-sidebar-label bold'>Context</div>
                                                <input className="input-field" maxLength={250} required={false} placeholder="Optional"  value={context} onChange={(e) => setContext(e.target.value)} />
                                            </div>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2' style={{
                                                textAlign: 'right'
                                            }}>
                                                 <Button variant='primary' onClick={() => searchCdnLink()} style={{
                                                    width: '80px',
                                                    height: '35px',
                                                    fontSize: '13px',
                                                    marginTop: '-20px'
                                                 }}>Search</Button>
                                            </div>
                                        </ExpandableComponent>
                                        <ExpandableComponent id="search-by-message-id" header="Search by Message ID" defaultOpened={true}>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2'>
                                                <div className='mainPage-main-components-sidebar-label bold'>Message ID</div>
                                                <input className="input-field" maxLength={250} required={false} placeholder="391465..." value={messageId} onChange={(e) => setMessageId(e.target.value)}/>
                                            </div>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2'>
                                                <div className='mainPage-main-components-sidebar-label bold'>Channel ID</div>
                                                <input className="input-field" maxLength={250} required={false} placeholder="231661..." value={channelId} onChange={(e) => setChannelId(e.target.value)} />
                                            </div>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2 bold'>
                                                <div className='mainPage-main-components-sidebar-label bold'>Context</div>
                                                <input className="input-field" maxLength={250} required={false} placeholder="Optional" value={context} onChange={(e) => setContext(e.target.value)}/>
                                            </div>
                                            <div className='mainPage-main-components-sidebar-infoLine pd2' style={{
                                                textAlign: 'right'
                                            }}>
                                                 <Button variant='primary' onClick={() => searchMsgID()} style={{
                                                    width: '80px',
                                                    height: '35px',
                                                    fontSize: '13px',
                                                    marginTop: '-20px'
                                                 }}>Search</Button>
                                            </div>
                                        </ExpandableComponent>
                                    </div>
                                    <ResultsCard header="Message Results">
                                        {data.length === 0 ? <>
                                            <div className='search-no-results'>
                                                <img src={NoResults} alt="No data yet, try to search by CDN link or message ID." style={{
                                                    width: 'auto',
                                                }}></img>
                                                <p>No data yet, try to search by CDN link or message ID.</p>
                                            </div>
                                        </> : <>
                                                {data.map((message, i) => (
                                                    <div className={`message-result-container ${selectedMessage && selectedMessage.id === message.id ? 'selected-message' : ''}`} key={message.id} onClick={() => setSelectedMessage(message)}>
                                                        <img
                                                            src={DefaultAvatar}
                                                            alt={`${message.author.username}'s avatar`}
                                                            style={{
                                                                width: '40px',
                                                                height: '40px',
                                                                borderRadius: '50%',
                                                                marginRight: '15px'
                                                            }}
                                                        />
                                                        <div className='message-result-body'>
                                                            <div className='message-header-details'>
                                                                <h1>{message.author.username}</h1>
                                                                <span>{new Date().toLocaleDateString()} at {new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</span>
                                                            </div>
                                                            <h1>{message.content}</h1>
                                                            {message.attachments.length > 0 && (
                                                                <div className='message-result-attachments'>
                                                                    <span>{message.attachments.length} {message.attachments.length == 1 ? "Attachment" : "Attachments"}:</span>
                                                                    <div className='message-attachments'>
                                                                        {message.attachments.map((attachment) => (
                                                                            <div className='attachment-detail' key={attachment.id} title="Click to copy URL" onClick={() => {
                                                                                navigator.clipboard.writeText(attachment.url); //dont open it automatically as it could be illegal content & now it's cached on their browser
                                                                            }}>
                                                                                <Ic_paperclip/> <span>{attachment.filename}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className='message-actions'>
                                                            <Ic_dots
                                                                style={{
                                                                    width: '14px',
                                                                    height: '14px',
                                                                    color: '#d8d8d8',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation(); 

                                                                    setPopoutPosition({
                                                                        x: e.clientX,
                                                                        y: e.clientY
                                                                    });

                                                                    setPopoutContextMenu(popoutContextMenu ? null : [
                                                                        {
                                                                            name: "Copy", not_implemented_yet: false, action: () => {
                                                                                navigator.clipboard.writeText(message.content);
                                                                            }
                                                                        },
                                                                        { 
                                                                            name: "Delete Message", not_implemented_yet: false, action: () => {
                                                                                deleteMessage(message);
                                                                            } 
                                                                        },
                                                                        {
                                                                            name: "Copy ID", not_implemented_yet: false, action: () => {
                                                                                navigator.clipboard.writeText(message.id);
                                                                            }
                                                                        }
                                                                    ]);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {popoutContextMenu !== null ? (
                                                    <div className='mainPage-main-components-popouts-container' ref={dropdownRef} style={{
                                                        top: popoutPosition.y,
                                                        left: popoutPosition.x,
                                                        position: 'fixed',
                                                        right: 'auto',
                                                        height: 'auto',
                                                        width: 'auto',
                                                    }}>
                                                        <div className='mainPage-main-popouts' style={{
                                                            transform: 'translate(-10px, 0)', 
                                                            top: '0', 
                                                            right: '0'
                                                        }}>
                                                            <Dropdown contextMenu={popoutContextMenu} onClose={() => {
                                                                setPopoutContextMenu(null);
                                                            }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : <></>}
                                        </>}
                                    </ResultsCard>
                                </>
                                {confirmation != null && (
                                    <div id="overlay">
                                        <Confirmation onYes={confirmation.onYes} onNo={closeConfirmation} summary={confirmation.summary} />
                                    </div>
                                )}
                            </>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Messages;