import './index.css';
import '@oldcord/frontend-shared/fonts.css';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import React, { createContext, useContext, useState, useEffect } from 'react';
import Login from './components/login';
import Servers from './components/main/servers';
import AuthCheck from './components/authcheck';
import Users from './components/main/users';
import Reports from './components/main/reports';
import Messages from './components/main/messages';

const root = ReactDOM.createRoot(document.getElementById('app-mount'));
const AuthUserContext = createContext(null);

export const useAuthUser = () => useContext(AuthUserContext);

function getBaseUrl() {
  if (window.location.pathname.includes("/assets/admin")) {
    return "/assets/admin"
  } else {
    return "/admin"
  }
};

const AuthUserProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchUserData = async () => {
        const token = localStorage.getItem("token");

        if (!token) {
            setUser(null);
            setIsLoading(false);
            return;
        }

        try {
            const storedUser = localStorage.getItem("user_data");

            if (storedUser) {
                setUser(JSON.parse(storedUser));
                setIsLoading(false);
            }

            const response = await fetch(`${window.ADMIN_ENV.API_ENDPOINT}/users/@me`, {
                headers: {
                    'Authorization': token.replace(/"/g, ''),
                    'Cookie': 'release_date=october_5_2017;',
                }
            });

            if (!response.ok) {
                localStorage.removeItem("token");
                localStorage.removeItem("user_data");
                setUser(null);
                location.reload();
                throw new Error('Failed to fetch user data');
            }

            const userData = await response.json();
    
            setUser(userData);

            localStorage.setItem("user_data", JSON.stringify(userData));
        } catch (error) {
            console.error("Error fetching user data:", error);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []); 

    const contextValue = {
        user,
        isLoading,
        fetchUserData,
    };

    return (
        <AuthUserContext.Provider value={contextValue}>
            {children}
        </AuthUserContext.Provider>
    );
};

root.render(
  <React.StrictMode>
    <AuthUserProvider>
      <Router basename={getBaseUrl()}>
        <Routes>
          <Route index path="/" element={<AuthCheck appPage={Servers} enforced={true} />} />
          <Route path="/servers" element={<AuthCheck appPage={Servers} enforced={true} />} />
          <Route path="/users" element={<AuthCheck appPage={Users} enforced={true} />} />
          <Route path="/reports" element={<AuthCheck appPage={Reports} enforced={true} />} />
          <Route path="/messages" element={<AuthCheck appPage={Messages} enforced={true} />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </Router>
    </AuthUserProvider>
  </React.StrictMode>
);