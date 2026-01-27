import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
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
    const providerId = params.get("providerId");

    // Agar required params missing ho to home redirect
    if (!sessionId || !serviceId || !providerId) {
      toast.error("Ugyldige parametere. Du blir sendt til forsiden.");
      navigate("/", { replace: true });
      return;
    }

    // Chat creation
    if (!hasCreatedChat.current) {
      hasCreatedChat.current = true; // Strict Mode double render prevention

      mainLink
        .post("/api/chats/create", { providerId, serviceId, sessionId })
        .then((res) => {
          toast.success("Samtale opprettet!");
          navigate(`/messages/${res.data._id}`, { replace: true });
        })
        .catch((err) => {
          console.error("Chat creation failed:", err);
          toast.error("Kunne ikke opprette samtale");
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
