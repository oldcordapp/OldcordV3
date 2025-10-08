import React from 'react';
import { Navigate } from 'react-router-dom';

function AuthCheck({ appPage, enforced }) {
    let AppPage = appPage;

    let authToken = localStorage.getItem('token');

    if (enforced && !authToken) {
        return <Navigate to="/login" />;
    }

    return <AppPage/>;
}

export default AuthCheck;