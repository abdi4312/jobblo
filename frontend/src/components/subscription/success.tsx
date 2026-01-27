import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import mainLink from "../../api/mainURLs";
import { RevolvingDot } from "react-loader-spinner"; // Loading spinner

const SuccessPage = () => {
  const [status, setStatus] = useState("loading"); // loading | success | failed | error
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPaymentStatus = async () => {
      try {
        const query = new URLSearchParams(location.search);
        const sessionId = query.get("session_id");

        if (!sessionId) {
          setStatus("no-session");
          return;
        }

        const res = await mainLink.get(`/api/stripe/checkout-session/${sessionId}`);
        console.log("Payment status response:", res.data);

        if (res.data.payment_status === "paid") {
          setStatus("success");
        } else {
          setStatus("failed");
        }
      } catch (err) {
        console.error("Error fetching payment status:", err);
        setStatus("error");
      }
    };

    fetchPaymentStatus();
  }, [location]);

  // Optional: Redirect user after success
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => {
        navigate("/dashboard"); // redirect to dashboard after 3 sec
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      {status === "loading" && (
        <div className="flex flex-col items-center">
          <RevolvingDot
            height="80"
            width="80"
            color="#4fa94d"
            ariaLabel="loading"
          />
          <p className="mt-4 text-gray-700">Checking your payment...</p>
        </div>
      )}

      {status === "success" && (
        <h1 className="text-green-600 text-2xl font-semibold">
          Payment succeeded! Redirecting...
        </h1>
      )}

      {status === "failed" && (
        <h1 className="text-red-600 text-2xl font-semibold">
          Payment not completed.
        </h1>
      )}

      {status === "error" && (
        <h1 className="text-red-600 text-2xl font-semibold">
          Error fetching payment status.
        </h1>
      )}

      {status === "no-session" && (
        <h1 className="text-red-600 text-2xl font-semibold">
          No session ID provided.
        </h1>
      )}
    </div>
  );
};

export default SuccessPage;
