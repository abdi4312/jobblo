import { useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { getExtraContactStatus } from '../api/stripeAPI';
import { createJobRequest } from '../api/orderAPI';
import { Spinner } from '../components/Ui/Spinner';

function ContactSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasCreatedChat = useRef(false); // Double execution rokne ke liye
  const requestMutation = useMutation({
    mutationFn: async ({ sessionId, serviceId }: { sessionId: string; serviceId: string }) => {
      // First verify payment and let backend handle transactions
      await getExtraContactStatus(sessionId);
      // Then create job request (which will now pass middleware because of transaction)
      return createJobRequest({ serviceId, sessionId });
    },
    onSuccess: (_res, { serviceId }) => {
      toast.success('Forespørsel sendt! Venter på godkjenning.');
      navigate(`/job-listing/${serviceId}`, { replace: true });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      console.error('Payment verification or request failed:', err);
      toast.error(err.response?.data?.message || 'Kunne ikke fullføre forespørselen');
    },
  });
  const loading = !requestMutation.isError;
  const { mutate: sendRequest } = requestMutation;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id');
    const serviceId = params.get('serviceId');

    // Agar required params missing ho to home redirect
    if (!sessionId || !serviceId) {
      toast.error('Ugyldige parametere. Du blir sendt til forsiden.');
      navigate('/', { replace: true });
      return;
    }

    // Payment and Job Request creation
    if (!hasCreatedChat.current) {
      hasCreatedChat.current = true; // Strict Mode double render prevention

      sendRequest({ sessionId, serviceId });
    }
  }, [location, navigate, sendRequest]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      {loading && (
        <>
          <Spinner size={40} className="text-[#2E6641]" />
          <p className="mt-4 text-gray-700 text-lg">Bekrefter betaling, vennligst vent...</p>
        </>
      )}
      {!loading && (
        <>
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-semibold">Noe gikk galt</h2>
        </>
      )}
    </div>
  );
}

export default ContactSuccessPage;
