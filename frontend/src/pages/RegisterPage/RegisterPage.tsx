import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "../../assets/icons";
import { mainLink } from "../../api/mainURLs";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) {
      alert("Passordene matcher ikke");
      return;
    }

    if (!formData.name || !formData.email || !formData.password) {
      alert("Vennligst fyll ut alle feltene");
      return;
    }

    setLoading(true);
    try {
      const registerData = {
        name: formData.name,
        email: formData.email,
        password: formData.password
      };

      const response = await fetch(`${mainLink}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(registerData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      const data = await response.json();
      console.log("Registration successful:", data);
      alert("Registrering vellykket!");
      navigate("/login");
    } catch (error) {
      console.error("Error registering:", error);
      alert("Kunne ikke registrere bruker");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      minHeight: "100vh",
      padding: "20px",
      paddingTop: "60px"
    }}>

      {/* Register Card */}
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
          Registrer deg til
        </h2>

        {/* Jobblo Logo */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "24px"
        }}>
          <Icons.JobbloIcon />
        </div>

        {/* Name Fields */}
          <input
            type="text"
            placeholder="Fornavn"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
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

        {/* Email Input */}
        <input
          type="email"
          placeholder="E-post"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
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
          value={formData.password}
          onChange={(e) => handleInputChange("password", e.target.value)}
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

        {/* Confirm Password Input */}
        <input
          type="password"
          placeholder="Bekreft passord"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
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
          Ved å registrere deg godtar du våre{" "}
          <a href="#" style={{ color: "#FF5B24", textDecoration: "none" }}>
            vilkår og betingelser
          </a>
          {" "}og{" "}
          <a href="#" style={{ color: "#FF5B24", textDecoration: "none" }}>
            personvernregler
          </a>
          .
        </p>

        {/* Register Button */}
        <button
          onClick={handleRegister}
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
          {loading ? "Registrerer..." : "Registrer deg"}
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
          Avbryt
        </button>

        {/* Login Section */}
        <div style={{
          textAlign: "center",
          paddingTop: "16px",
          borderTop: "1px solid #e0e0e0"
        }}>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "12px" }}>
            Har du allerede en konto?
          </p>
          <button
            onClick={() => navigate("/login")}
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
            Logg inn
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <div style={{
        position: "absolute",
        top: "20px",
        right: "20px"
      }}>
        <select
          style={{
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: "white"
          }}
        >
          <option value="EN">EN</option>
          <option value="NO">NO</option>
        </select>
      </div>
    </div>
  );
}
