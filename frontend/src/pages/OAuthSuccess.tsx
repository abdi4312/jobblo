// OAuthSuccess.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../stores/userStore";

export default function OAuthSuccess() {
  const navigate = useNavigate();
const { fetchProfile} = useUserStore((state) => state);

  useEffect(() => {

    fetchProfile();
      navigate("/");
    // }
  }, []);

  return <h2>Logging you in...</h2>;
}
