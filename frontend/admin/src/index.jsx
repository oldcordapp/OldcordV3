import './index.css';
import '@oldcord/frontend-shared/fonts.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import AuthCheck from './components/authcheck';
import { AuthUserProvider } from './components/context/AuthContext';
import Login from './components/login';
import AuditLogs from './components/main/auditlogs';
import Bots from './components/main/bots';
import Messages from './components/main/messages';
import PRIVILEGE from './components/main/privilege';
import Reports from './components/main/reports';
import Servers from './components/main/servers';
import Settings from './components/main/settings';
import Staff from './components/main/staff';
import Updates from './components/main/updates';
import Users from './components/main/users';
import MfaNotice from './components/mfanotice';

const root = ReactDOM.createRoot(document.getElementById('app-mount'));

function getBaseUrl() {
  if (window.location.pathname.includes('/assets/admin')) {
    return '/assets/admin';
  } else {
    return '/admin';
  }
}

root.render(
  <React.StrictMode>
    <AuthUserProvider>
      <Router basename={getBaseUrl()}>
        <Routes>
          <Route
            index
            path="/"
            element={<AuthCheck enforced={true} minClearance={PRIVILEGE.JANITOR} />}
          />
          <Route
            path="/servers"
            element={<AuthCheck appPage={Servers} enforced={true} minClearance={PRIVILEGE.ADMIN} />}
          />
          <Route
            path="/bots"
            element={<AuthCheck appPage={Bots} enforced={true} minClearance={PRIVILEGE.ADMIN} />}
          />
          <Route
            path="/users"
            element={<AuthCheck appPage={Users} enforced={true} minClearance={PRIVILEGE.ADMIN} />}
          />
          <Route
            path="/staff"
            element={
              <AuthCheck appPage={Staff} enforced={true} minClearance={PRIVILEGE.INSTANCE_OWNER} />
            }
          />
          <Route
            path="/audit-logs"
            element={
              <AuthCheck
                appPage={AuditLogs}
                enforced={true}
                minClearance={PRIVILEGE.INSTANCE_OWNER}
              />
            }
          />
          <Route
            path="/reports"
            element={
              <AuthCheck appPage={Reports} enforced={true} minClearance={PRIVILEGE.JANITOR} />
            }
          />
          <Route
            path="/messages"
            element={
              <AuthCheck appPage={Messages} enforced={true} minClearance={PRIVILEGE.MODERATOR} />
            }
          />
          <Route
            path="/updates"
            element={
              <AuthCheck appPage={Updates} enforced={true} minClearance={PRIVILEGE.JANITOR} />
            }
          />
          <Route
            path="/settings"
            element={
              <AuthCheck
                appPage={Settings}
                enforced={true}
                minClearance={PRIVILEGE.INSTANCE_OWNER}
              />
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/mfa-notice" element={<MfaNotice />} />
        </Routes>
      </Router>
    </AuthUserProvider>
  </React.StrictMode>,
);
