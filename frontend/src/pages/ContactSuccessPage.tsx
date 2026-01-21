import React, { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import mainLink from "../api/mainURLs";

function ContactSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const hasCreatedChat = useRef(false); // Double execution rokne ke liye

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get("session_id");
    const serviceId = params.get("serviceId");
    const providerId = params.get("providerId");
    
    if (!params) {
      navigate("/");
    }
    if (sessionId && serviceId && providerId && !hasCreatedChat.current) {
      hasCreatedChat.current = true; // Taaki useEffect do baar na chale (Strict Mode)

      mainLink
        .post("/api/chats/create", {
          providerId,
          serviceId,
          sessionId,
        })
        .then((res) => {
          toast.success("Samtale opprettet!");
          navigate(`/messages/${res.data._id}`, { replace: true });
        })
        .catch((err) => {
          console.error("Chat creation failed:", err);
          toast.error("Kunne ikke opprette samtale");
        });
    } else if (!sessionId) {
      navigate("/");
    }
  }, [location, navigate]);

  return (
    <div style={{ padding: "100px 20px", textAlign: "center" }}>
      <div style={{ fontSize: "50px" }}>✅</div>
      <h2>Betaling fullført</h2>
      <p>Vi gjør klar samtalen din, vennligst vent...</p>
    </div>
  );
}

export default ContactSuccessPage;
