import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Login from './components/login';
import Main from './components/main/index';
import Servers from './components/main/servers';

const root = ReactDOM.createRoot(document.getElementById('app-mount'));

function getBaseUrl() {
  if (window.location.pathname.includes("/assets/admin")) {
    return "/assets/admin"
  } else {
    return "/admin"
  }
};

root.render(
  <React.StrictMode>
    <Router basename={getBaseUrl()}>
      <Routes>
        <Route path="/" element={<Main />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </Router>
  </React.StrictMode>
);