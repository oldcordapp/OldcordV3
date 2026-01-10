import { useEffect, useState } from 'react';
import { useAuthUser } from '../context/AuthContext';
import Sidebar from './sidebar';
import Avatar from './avatar';
import Paginator from './paginator';
import NoResults from '../../assets/img_noresults.svg';
import DefaultAvatar from '../../assets/default-avatar.png';
import AuditLog from './auditlog';
import ResultsCard from './resultscard';
const AuditLogs = () => {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const { user } = useAuthUser();
  const avatarPath =
    user && user.avatar
      ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png`
      : DefaultAvatar;

  useEffect(() => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/staff/audit-logs`, {
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
        }
      })
      .catch((error) => {
        setError(error.message);
        setData([]);
      });
  }, []);

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        <div className="mainPage-container">
          <Sidebar active="Audit Logs"></Sidebar>
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
            <div
              className="mainPage-main-components"
              style={{
                display: 'block',
              }}
            >
              {data && Array.isArray(data) && data.length > 0 ? (
                <>
                  <Paginator
                    header={`Audit Logs (Showing a maximum of 50 entries per page)`}
                    tabs={[
                      'Action',
                      'Actioned By',
                      'Moderation ID',
                      'Timestamp',
                      'Reasoning',
                      'Moderated ID',
                      'Moderation Props',
                    ]}
                    maxPerPage={50}
                  >
                    {data.map((audit_log_entry, i) => (
                      <AuditLog
                        key={i}
                        action={audit_log_entry.action}
                        actioned_by={audit_log_entry.actioned_by}
                        moderation_id={audit_log_entry.moderation_id}
                        timestamp={audit_log_entry.timestamp}
                        reasoning={audit_log_entry.reasoning}
                        moderated_id={audit_log_entry.moderated.id}
                        moderation_props={JSON.stringify(audit_log_entry.moderated)}
                      ></AuditLog>
                    ))}
                  </Paginator>
                </>
              ) : (
                <ResultsCard header="Audit Logs">
                  <div className="search-no-results">
                    <img
                      src={NoResults}
                      alt="No data yet, as staff members act upon other users, servers & messages, it will appear here."
                      style={{
                        width: 'auto',
                      }}
                    ></img>
                    <p>
                      No data yet. When staff members act upon other users, servers & messages, it
                      will appear here.
                    </p>
                  </div>
                </ResultsCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AuditLogs;
