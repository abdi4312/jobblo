// React example: /subscription/success page
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import mainLink from "../../api/mainURLs";

const SuccessPage = () => {
    const [status, setStatus] = useState("Loading...");
    const location = useLocation();

    useEffect(() => {
        const fetchPaymentStatus = async () => {
            try {
                const query = new URLSearchParams(location.search);
                const sessionId = query.get("session_id");

                if (!sessionId) {
                    setStatus("No session ID provided.");
                    return;
                }

                const res = await mainLink.get(`/api/stripe/checkout-session/${sessionId}`);
                console.log(res.data);

                if (res.data.payment_status === "paid") {
                    setStatus("Payment succeeded!");
                } else {
                    setStatus("Payment not completed.");
                }
            } catch (err) {
                console.error(err);
                setStatus("Error fetching payment status.");
            }
        };

        fetchPaymentStatus();
    }, [location]);

    return <h1>{status}</h1>;
};

export default SuccessPage;
