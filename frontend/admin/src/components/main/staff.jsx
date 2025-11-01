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
import { useAuthUser } from '../context/AuthContext';
import ExpandableComponent from './expandablecomponent';
import ResultsCard from './resultscard';
import Dropdown from './dropdown';
import InputMultiple from '../modals/inputmultiple';
import Confirmation from '../modals/confirmation';
import AuditLog from './auditlog';
import { priviledgeFriendlyLabel } from './privilege';

const Staff = () => {
    const location = useLocation();
    const [data, setData] = useState([]); //messages
    const [popoutContextMenu, setPopoutContextMenu] = useState(null);
    const dropdownRef = useRef(null);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [error, setError] = useState(null);
    const [confirmation, setConfirmation] = useState(null);
    const [inputPopup, setInputPopup] = useState(null);
    const closeConfirmation = () => setConfirmation(null);
    const closeInputPopup = () => setInputPopup(null);
    const navigate = useNavigate();
    const { user } = useAuthUser();
    const avatarPath = (user && user.avatar) ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png` : DefaultAvatar;

    useEffect(() => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/staff`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
            },
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code >= 400) {
                setError(data.message);
                setData([]);
            } else {
                setData(data);
            }
        }).catch((error) => {
            setError(error.message);
            setData([]);
        });
    }, []);

    const checkAndAddStaffUser = (fieldValues) => {
        let user_id = fieldValues['User ID'];
        let privilege = fieldValues['Privilege'];

        if (user_id === '' || privilege === '') {
            return;
        }

        privilege = parseInt(privilege);

        if (isNaN(privilege)) {
            return;
        }

        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/staff`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user_id,
                privilege: privilege
            }),
            method: "POST"
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

        closeInputPopup();
    }

    const clearAuditLog = () => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/staff/${selectedStaff.id}/audit-logs`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
                'Content-Type': 'application/json'
            },
            method: "DELETE"
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code >= 400) {
                setError(data.message);
            } else {
                let data1 = data;
                let staff = data1.find(x => x.id === selectedStaff.id);

                if (staff) {
                    staff.staff_details.audit_log = [];

                    setData(data1);
                    setSelectedStaff(staff);
                }
            }
        }).catch((error) => {
            setError(error.message);
        });

        closeConfirmation();
    }

    const removeFromStaff = () => {
        fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/staff/${selectedStaff.id}`, {
            headers: {
                'Authorization': localStorage.getItem("token").replace(/"/g, ''),
                'Cookie': 'release_date=october_5_2017;',
                'Content-Type': 'application/json'
            },
            method: "DELETE"
        }).then((response) => {
            return response.json();
        }).then((data) => {
            if (data.code >= 400) {
                setError(data.message);
            }
        }).catch((error) => {
            setError(error.message);
        });
    }

    const menuActions = [
        { name: "Update Privilege", not_implemented_yet: true, action: () => { } },
        { name: "Clear Audit Log", not_implemented_yet: selectedStaff && selectedStaff.staff_details.audit_log.length === 0, action: () => setConfirmation({ summary: `Are you sure you want to clear "${selectedStaff.username}"'s audit log?`, onYes: clearAuditLog }) },
        { name: "Remove From Staff", not_implemented_yet: false, action: () => setConfirmation({ summary: `Are you sure you want to remove "${selectedStaff.username}" from staff?`, onYes: () => {
            removeFromStaff();
            closeConfirmation();
            window.location.reload();
        } }) },
    ];

    function getPrivilegeName(value) {
        return Object.keys(priviledgeFriendlyLabel).find(key => priviledgeFriendlyLabel[key] === value);
    }

    return (
        <>
            <div style={{ 'display': 'flex', 'flex': 1, 'minHeight': '100vh' }}>
                <div className='mainPage-container'>
                    <Sidebar active="Staff"></Sidebar>
                    <div className='mainPage-main'>
                        <div className='mainPage-main-header'>
                            <Avatar path={avatarPath} style={{
                                right: '20px',
                                position: 'absolute'
                            }}></Avatar>
                        </div>
                        <div className='mainPage-main-components' style={{
                            display: 'block'
                        }}>
                            <>
                                <>
                                    <ResultsCard header="Staff">
                                        {
                                            <div className='staff-container'>
                                                {data.map((data, i) => (
                                                    <div className={`staff-card ${data.id === user.id ? "disabled" : ""}`}>
                                                        <h2>{data.username}<span>#{data.discriminator}</span></h2>
                                                        <span style={{
                                                            color: 'rgb(144, 153, 164)',
                                                            fontSize: '15px'
                                                        }}>Privilege: {getPrivilegeName(data.staff_details.privilege)}</span>
                                                        <div className='staff-buttons'>
                                                            <button className={`largeButton ${data.id === user.id ? "no-button" : "yes-button"}`} onClick={() => {
                                                                if (data.id !== user.id) {
                                                                    setSelectedStaff(data);
                                                                    console.log(data);
                                                                }
                                                            }} 
                                                            disabled={data.id === user.id ? true : false} 
                                                            title={data.id === user.id ? "You cannot change yourself! If you REALLY want to, you know what to do." : ""}>Manage</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="add-staff" onClick={() => {
                                                    setInputPopup({
                                                        summary: `Oh you're hiring, huh?`,
                                                        fields: [{
                                                            type: 'text',
                                                            name: 'User ID',
                                                            placeholder: "The user's ID as it appears on your instance",
                                                        }, {
                                                            type: 'number',
                                                            name: 'Privilege',
                                                            placeholder: "Enter a value between 1-3",
                                                            minValue: "1",
                                                            maxValue: "3"
                                                        }],
                                                        showFieldSpan: true,
                                                        cancelName: `Cancel`,
                                                        onComplete: (fieldValues) => {
                                                            checkAndAddStaffUser(fieldValues);
                                                        },
                                                        completeName: `Submit`
                                                    })
                                                }}>
                                                    +
                                                </div>
                                            </div>
                                        }
                                    </ResultsCard>
                                    {selectedStaff &&
                                        <>
                                            <div style={{display: 'flex', alignItems: 'flex-start'}}>
                                                <div className='mainPage-main-components-sidebar'>
                                                    <Ic_dots style={{
                                                        width: '12px',
                                                        height: '12px',
                                                        color: 'gray',
                                                        position: 'absolute',
                                                        right: '10px',
                                                        top: '10px',
                                                        cursor: 'pointer'
                                                    }} onClick={() => {
                                                        setPopoutContextMenu(popoutContextMenu ? null : menuActions);
                                                    }} />
                                                    {popoutContextMenu !== null ? (
                                                        <div className='mainPage-main-components-popouts-container' ref={dropdownRef}>
                                                            <div className='mainPage-main-popouts'>
                                                                <Dropdown contextMenu={popoutContextMenu} onClose={() => setPopoutContextMenu(null)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : <></>}
                                                    <div className="mainPage-main-components-sidebar-guildAvatar">
                                                        <div className='guildAvatar avatar' style={{ 'backgroundImage': `url('${selectedStaff.avatar == null ? DefaultAvatar : `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/` + selectedStaff.id + '/' + selectedStaff.avatar + ".png"}` }}></div>
                                                    </div>
                                                    <div className='mainPage-main-components-sidebar-text'>{selectedStaff.username}<span style={{
                                                        color: '#9099a4',
                                                        fontSize: '17px'
                                                    }}>#{selectedStaff.discriminator}</span></div>
                                                    <div className='mainPage-main-components-sidebar-separator'></div>
                                                    <div className='mainPage-main-components-sidebar-infoLine'>
                                                        <div className='mainPage-main-components-sidebar-label'>User ID</div>
                                                        {selectedStaff.id}
                                                    </div>
                                                    <div className='mainPage-main-components-sidebar-infoLine'>
                                                        <div className='mainPage-main-components-sidebar-label'>Privilege</div>
                                                        {selectedStaff.staff_details.privilege}
                                                    </div>
                                                    <div className='mainPage-main-components-sidebar-infoLine'>
                                                        <div className='mainPage-main-components-sidebar-label'>Audit Log Entries</div>
                                                        {selectedStaff.staff_details.audit_log.length}
                                                    </div>
                                                </div>
                                                {selectedStaff.staff_details.audit_log && Array.isArray(selectedStaff.staff_details.audit_log) && selectedStaff.staff_details.audit_log.length > 0 ? <>
                                                    <Paginator header="Audit Log" tabs={['Action', 'Moderation ID', 'Timestamp', 'Reasoning', 'Moderated ID', 'Moderation Props']}>
                                                        {selectedStaff.staff_details.audit_log.map((audit_log_entry, i) => (
                                                            <AuditLog key={i} action={audit_log_entry.action} moderation_id={audit_log_entry.moderation_id} timestamp={audit_log_entry.timestamp} reasoning={audit_log_entry.reasoning} moderated_id={audit_log_entry.moderated.id} moderation_props={JSON.stringify(audit_log_entry.moderated)}></AuditLog>
                                                        ))}
                                                    </Paginator>
                                                </> : <></>}
                                            </div>

                                        </>
                                    }
                                </>
                                {confirmation != null && (
                                    <div id="overlay">
                                        <Confirmation onYes={confirmation.onYes} onNo={closeConfirmation} summary={confirmation.summary} />
                                    </div>
                                )}

                                {inputPopup != null && (
                                    <div id="overlay">
                                        <InputMultiple summary={inputPopup.summary} fields={inputPopup.fields} onCancel={closeInputPopup} cancelName={inputPopup.cancelName} onComplete={inputPopup.onComplete} completeName={inputPopup.completeName} />
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

export default Staff;