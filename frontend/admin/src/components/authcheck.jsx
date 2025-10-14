import { Navigate } from 'react-router-dom';

function AuthCheck({ appPage, enforced, minClearance }) {
    let AppPage = appPage;

    let authToken = localStorage.getItem('token');

    if (enforced && !authToken) {
        return <Navigate to="/login" />;
    }

    let user_data = JSON.parse(localStorage.getItem('user_data'));
    
    if (!user_data) {
        return <Navigate to="/login"/>;
    }

    if (user_data.staff_details && user_data.staff_details.privilege < minClearance) {
        return <Navigate to="/"/>;
    }

    return <AppPage/>;
}

export default AuthCheck;