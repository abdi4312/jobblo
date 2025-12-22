import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "../../assets/icons";
import { mainLink } from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";
import { toast } from 'react-toastify';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Vennligst fyll ut alle feltene");
      return;
    }

    setLoading(true);
    try {
      const loginData = {
        email: email,
        password: password
      };

      const response = await fetch(`${mainLink}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          toast.error("Feil e-post eller passord");
        } else {
          toast.error("Kunne ikke logge inn");
        }
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log("Login successful:", data);
      
      // Store user and tokens in Zustand store
      login(
        data.user,
        { 
          accessToken: data.token,
          refreshToken: data.refreshToken 
        }
      );
      
      toast.success("Innlogging vellykket!");
      navigate("/");
    } catch (error) {
      console.error("Error logging in:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      padding: "20px"
    }}>
      {/* Vipps Logo */}
      <div style={{
        fontSize: "32px",
        fontWeight: "bold",
        color: "#FF5B24",
        marginBottom: "40px",
        fontFamily: "Arial, sans-serif"
      }}>
        Vipps

      </div>

      {/* Login Card */}
      <div style={{
          backgroundColor: "white",
          borderRadius: "16px",
          padding: "40px 30px",
          width: "80%",
          maxWidth: "380px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
        {/* Title */}
        <h2 style={{
            textAlign: "center",
            fontSize: "20px",
            fontWeight: "600",
            marginBottom: "8px"
        }}>
          Log in to
        </h2>

        {/* Jobblo Logo */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "24px"
        }}>
          <Icons.JobbloIcon />
        </div>

        {/* Email Input */}
        <input
          type="email"
          placeholder="E-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "16px",
            backgroundColor: "#f9f9f9",
            outline: "none",
            marginBottom: "12px",
            boxSizing: "border-box"
          }}
        />

        {/* Password Input */}
        <input
          type="password"
          placeholder="Passord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            fontSize: "16px",
            backgroundColor: "#f9f9f9",
            outline: "none",
            marginBottom: "20px",
            boxSizing: "border-box"
          }}
        />

        {/* Info Text */}
        <p style={{
          fontSize: "12px",
          color: "#888",
          marginBottom: "20px",
          lineHeight: "1.5"
        }}>
          Ved å logge inn godtar du våre{" "}
          <a href="#" style={{ color: "#FF5B24", textDecoration: "none" }}>
            vilkår og betingelser
          </a>
          .
        </p>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            backgroundColor: "#C8B4D4",
            color: "white",
            border: "none",
            borderRadius: "24px",
            fontSize: "16px",
            fontWeight: "600",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            marginBottom: "12px"
          }}
        >
          {loading ? "Logger inn..." : "Logg inn"}
        </button>

        {/* Cancel Link */}
        <button
          onClick={() => navigate(-1)}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#666",
            fontSize: "14px",
            cursor: "pointer",
            padding: "8px",
            marginBottom: "12px"
          }}
        >
          Cancel
        </button>

        {/* Register Section */}
        <div style={{
          textAlign: "center",
          paddingTop: "16px",
          borderTop: "1px solid #e0e0e0"
        }}>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "12px" }}>
            Har du ikke en konto?
          </p>
          <button
            onClick={() => navigate("/register")}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "transparent",
              color: "var(--color-primary)",
              border: "2px solid var(--color-primary)",
              borderRadius: "24px",
              fontSize: "16px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            Registrer deg
          </button>
        </div>
      </div>
    </div>
  );
}