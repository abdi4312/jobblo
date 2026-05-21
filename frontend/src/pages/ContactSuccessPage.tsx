import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-hot-toast";
import mainLink from "../api/mainURLs";
import { RevolvingDot } from "react-loader-spinner";

function ContactSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasCreatedChat = useRef(false); // Double execution rokne ke liye
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");
    const serviceId = params.get("serviceId");

    // Agar required params missing ho to home redirect
    if (!sessionId || !serviceId) {
      toast.error("Ugyldige parametere. Du blir sendt til forsiden.");
      navigate("/", { replace: true });
      return;
    }

    // Payment and Job Request creation
    if (!hasCreatedChat.current) {
      hasCreatedChat.current = true; // Strict Mode double render prevention

      // First verify payment and let backend handle transactions
      mainLink
        .get(`/api/stripe/extra-contact-status/${sessionId}`)
        .then(() => {
          // Then create job request (which will now pass middleware because of transaction)
          return mainLink.post("/api/orders/request", { serviceId, sessionId });
        })
        .then((res) => {
          toast.success("Forespørsel sendt! Venter på godkjenning.");
          navigate(`/job-listing/${serviceId}`, { replace: true });
        })
        .catch((err) => {
          console.error("Payment verification or request failed:", err);
          toast.error(err.response?.data?.message || "Kunne ikke fullføre forespørselen");
          setLoading(false);
        });
    }
  }, [location, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
      {loading && (
        <>
          <RevolvingDot
            height="80"
            width="80"
            color="#4fa94d"
            ariaLabel="loading"
          />
          <p className="mt-4 text-gray-700 text-lg">
            Vi gjør klar samtalen din, vennligst vent...
          </p>
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
