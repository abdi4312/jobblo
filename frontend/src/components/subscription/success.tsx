import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import mainLink from '../../api/mainURLs';
import { Spinner } from '../Ui/Spinner';

const SuccessPage = () => {
  const [status, setStatus] = useState('loading'); // loading | success | failed | error
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      try {
        const query = new URLSearchParams(location.search);
        const sessionId = query.get('session_id');

        if (!sessionId) {
          setStatus('no-session');
          return;
        }

        const res = await mainLink.get(`/api/stripe/checkout-session/${sessionId}`);
        console.log('Payment status response:', res.data);

        if (res.data.payment_status === 'paid') {
          setStatus('success');
        } else {
          setStatus('failed');
        }
      } catch (err) {
        console.error('Error fetching payment status:', err);
        setStatus('error');
      }
    };

    fetchPaymentStatus();
  }, [location]);

  // Optional: Redirect user after success
  useEffect(() => {
    if (status === 'success') {
      const timer = setTimeout(() => {
        // Was '/dashboard' — an admin route. AdminProtectedRoute bounced every
        // ordinary user to /profile, or to /login if auth was lost during the
        // Stripe round-trip, so the paid funnel ended in a redirect bounce.
        navigate('/membership', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {status === 'loading' && (
        <div className="flex flex-col items-center">
          <Spinner size={40} className="text-[#2E6641]" />
          <p className="mt-4 text-gray-700">Sjekker betalingen din ...</p>
        </div>
      )}

      {status === 'success' && (
        <h1 className="text-green-600 text-2xl font-semibold">
          Betalingen er gjennomført! Sender deg videre ...
        </h1>
      )}

      {status === 'failed' && (
        <h1 className="text-red-600 text-2xl font-semibold">Betalingen ble ikke fullført.</h1>
      )}

      {status === 'error' && (
        <h1 className="text-red-600 text-2xl font-semibold">
          Vi fikk ikke bekreftet betalingen. Kontakt kundeservice hvis beløpet er trukket.
        </h1>
      )}

      {status === 'no-session' && (
        <h1 className="text-red-600 text-2xl font-semibold">Mangler betalingsreferanse.</h1>
      )}
    </div>
  );
};

export default SuccessPage;
