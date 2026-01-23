import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VISITED_KEY = 'hasVisitedBefore';

export const FirstVisitRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hasVisited = localStorage.getItem(VISITED_KEY);
    
    if (hasVisited) {
      // User has visited before, redirect to job listing
      navigate('/job-listing', { replace: true });
    } else {
      // Mark as visited for next time
      localStorage.setItem(VISITED_KEY, 'true');
    }
  }, [navigate]);

  return null;
};
