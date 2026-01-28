import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import mainLink from "../../api/mainURLs";
import { toast } from "react-toastify";

export default function UrgentPaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processPayment = async () => {
      const sessionId = searchParams.get("session_id");

      if (!sessionId) {
        toast.error("Mangler betalingsinformasjon");
        navigate("/mine-annonser");
        return;
      }

      // Get the pending job data from localStorage
      const pendingJobDataStr = localStorage.getItem('pendingUrgentJob');
      if (!pendingJobDataStr) {
        toast.error("Mangler oppdragsinformasjon");
        navigate("/mine-annonser");
        return;
      }

      try {
        // Verify payment and create service
        const jobData = JSON.parse(pendingJobDataStr);
        const response = await mainLink.post(
          `/api/stripe/urgent-payment-success?session_id=${sessionId}`,
          jobData
        );

        if (response.data.success) {
          // Clear localStorage
          localStorage.removeItem('pendingUrgentJob');
          
          setProcessing(false);
          setTimeout(() => {
            navigate("/mine-annonser");
          }, 2000);
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        toast.error("Kunne ikke verifisere betaling");
        // Clear localStorage on error too
        localStorage.removeItem('pendingUrgentJob');
        navigate("/mine-annonser");
      }
    };

    processPayment();
  }, [searchParams, navigate]);

  return (
    <div style={{ 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center", 
      minHeight: "60vh",
      padding: "40px"
    }}>
      {processing ? (
        <>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚡</div>
          <h2>Aktiverer haster-funksjonen...</h2>
          <p style={{ color: "#666", marginTop: "10px" }}>Vennligst vent mens vi behandler betalingen din.</p>
        </>
      ) : (
        <>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>✅</div>
          <h2>Haster aktivert!</h2>
          <p style={{ color: "#666", marginTop: "10px" }}>
            Alle brukere kan nå kontakte deg umiddelbart uten ventetid.
          </p>
        </>
      )}
    </div>
  );
}
