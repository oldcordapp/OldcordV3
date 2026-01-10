import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Sidebar from './sidebar';
import Avatar from './avatar';
import Paginator from './paginator';
import DefaultAvatar from '../../assets/default-avatar.png';
import IcReports from '../../assets/ic_reports.svg?react';

import Report from './report';
import Button from '@oldcord/frontend-shared/components/button';
import { useAuthUser } from '../context/AuthContext';

const Reports = () => {
  const location = useLocation();
  const [data, setData] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [error, setError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [inputPopup, setInputPopup] = useState(null);
  const closeConfirmation = () => setConfirmation(null);
  const closeInputPopup = () => setInputPopup(null);
  const query = new URLSearchParams(location.search);
  const selectedId = query.get('selectedId');
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const avatarPath =
    user && user.avatar
      ? `${window.ADMIN_ENV.BASE_ENDPOINT}/avatars/${user.id}/${user.avatar}.png`
      : DefaultAvatar;

  useEffect(() => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/reports`, {
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
          setData(data);
        }
      })
      .catch((error) => {
        setError(error.message);
      });
  }, []);

  useEffect(() => {
    if (selectedId && data && Array.isArray(data)) {
      const targetId = String(selectedId);

      const report = data.find((report) => String(report.id) === targetId);

      if (report) {
        setSelectedReport(report);
      } else {
        setSelectedReport(null);
      }
    } else if (!selectedId) {
      setSelectedReport(null);
    }
  }, [data, selectedId]);

  const updateReport = async (id, action) => {
    fetch(`${window.ADMIN_ENV.API_ENDPOINT}/admin/reports/${id}`, {
      headers: {
        Authorization: localStorage.getItem('token').replace(/"/g, ''),
        Cookie: 'release_date=october_5_2017;',
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
      body: JSON.stringify({
        action: action.toUpperCase(),
      }),
    })
      .then(async (response) => {
        setData(data.filter((x) => x.id !== id));

        if (selectedReport && selectedReport.id === id) {
          setSelectedReport(null);
          navigate('/reports');
        }
      })
      .catch((error) => {
        setError(error.message);
      });
  };

  return (
    <>
      <div style={{ display: 'flex', flex: 1, minHeight: '100vh' }}>
        <div className="mainPage-container">
          <Sidebar active="Reports"></Sidebar>
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
                {data.length === 0 ? (
                  <>
                    <>
                      <div className="search-no-results">
                        <IcReports style={{ fill: '#4f5660', width: '125px', height: 'auto' }} />
                        <p>No Reports Found! Good Work!</p>
                      </div>
                    </>
                  </>
                ) : (
                  <>
                    <div className="mainPage-main-components-sidebar">
                      {selectedReport != null ? (
                        <>
                          <div className="mainPage-main-components-sidebar-guildAvatar">
                            <div className="avatar">
                              <IcReports
                                style={{ fill: '#4f5660', width: '125px', height: 'auto' }}
                              />
                            </div>
                          </div>
                          <div className="mainPage-main-components-sidebar-separator no-margin-override"></div>
                          <div className="mainPage-main-components-sidebar-infoLine">
                            <div className="mainPage-main-components-sidebar-label">Report ID</div>
                            {selectedReport.id}
                          </div>
                          <div className="mainPage-main-components-sidebar-infoLine">
                            <div className="mainPage-main-components-sidebar-label">Problem</div>
                            {selectedReport.problem}
                          </div>
                          <div className="mainPage-main-components-sidebar-infoLine">
                            <div className="mainPage-main-components-sidebar-label">Subject</div>
                            <textarea
                              readOnly={true}
                              maxLength={1250}
                              className="textarea-reports"
                              value={selectedReport.subject}
                            />
                          </div>
                          <div className="mainPage-main-components-sidebar-infoLine">
                            <div className="mainPage-main-components-sidebar-label">
                              Description
                            </div>
                            <textarea
                              readOnly={true}
                              maxLength={1250}
                              className="textarea-reports"
                              value={selectedReport.description}
                            />
                          </div>
                          <div className="mainPage-main-components-sidebar-infoLine">
                            <div className="mainPage-main-components-sidebar-label">
                              Email Address
                            </div>
                            {selectedReport.email_address === null
                              ? 'Not Provided'
                              : selectedReport.email_address}
                          </div>
                          <div className="mainPage-main-components-sidebar-separator no-margin-override"></div>
                          <div className="mainPage-main-components-sidebar-infoLine">
                            <div className="mainPage-main-components-sidebar-label">Actions</div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                alignContent: 'center',
                                flexDirection: 'column',
                                gap: '10px',
                              }}
                            >
                              <Button
                                variant="danger"
                                onClick={() => updateReport(selectedReport.id, 'discarded')}
                                style={{
                                  width: '100%',
                                  fontFamily: 'Nebula Sans',
                                }}
                              >
                                Discard
                              </Button>
                              <Button
                                variant="success"
                                onClick={() => updateReport(selectedReport.id, 'approved')}
                                style={{
                                  width: '100%',
                                  fontFamily: 'Nebula Sans',
                                }}
                              >
                                Approve
                              </Button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mainPage-main-components-sidebar-guildAvatar">
                            <div className="avatar">
                              <IcReports
                                style={{ color: '#4f5660', width: '125px', height: 'auto' }}
                              />
                            </div>
                          </div>
                          <div
                            className="mainPage-main-components-sidebar-text"
                            style={{ fontSize: '20px' }}
                          >
                            No Report Selected. You can choose to manage one on the right.
                          </div>
                        </>
                      )}
                    </div>
                    <div className="mainPage-main-components-main">
                      <div className="mainPage-main-components-wrapper">
                        {data && Array.isArray(data) && data.length > 0 ? (
                          <>
                            <Paginator
                              header="Reports"
                              tabs={['Id', 'Problem', 'Email Address', 'Actions']}
                            >
                              {data.map((entry, i) => (
                                <Report
                                  key={i}
                                  id={entry.id}
                                  problem={entry.problem}
                                  email_address={entry.email_address ?? 'Not Provided'}
                                  onApprove={() => updateReport(entry.id, 'approved')}
                                  onDiscard={() => updateReport(entry.id, 'discarded')}
                                  selected={selectedReport && selectedReport.id === entry.id}
                                ></Report>
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
                )}
              </>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Reports;
