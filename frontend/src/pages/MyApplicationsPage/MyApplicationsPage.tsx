import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Redirects to the combined overview page where "Mine søknader" tab is available
const MyApplicationsPage: React.FC = () => {
    const navigate = useNavigate();
    useEffect(() => {
        navigate('/my-applicants', { replace: true });
    }, [navigate]);
    return null;
};

export default MyApplicationsPage;
