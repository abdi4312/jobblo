import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "../../assets/icons";
import { mainLink } from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";
import { toast } from 'react-toastify';
import styles from "./loginPage.module.css";

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
    
    <div className={styles.wrapper}>
      {/* Vipps Logo */}
      <div className={styles.vippsLogo}>
        Vipps
      </div>

      {/* Login Card */}
      <div className={styles.card}>
        {/* Title */}
        <h2 className={styles.title}>
          Log in to
        </h2>

        {/* Jobblo Logo */}
        <div className={styles.jobbloLogo}>
          <Icons.JobbloIcon />
        </div>

        {/* Email Input */}
        <input
          type="email"
          placeholder="E-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
        />

        {/* Password Input */}
        <input
          type="password"
          placeholder="Passord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={styles.input}
        />

        {/* Info Text */}
        <p className={styles.infoText}>
          Ved å logge inn godtar du våre{" "}
          <a href="#" className={styles.link}>
            vilkår og betingelser
          </a>
          .
        </p>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className={styles.loginBtn}
          >
          {loading ? "Logger inn..." : "Logg inn"}
        </button>

        {/* Cancel Link */}
        <button
          onClick={() => navigate(-1)}
          className={styles.cancelBtn}
        >
          Cancel
        </button>

        {/* Register Section */}
        <div className={styles.registerSection}>
          <p className={styles.registerText}>
            Har du ikke en konto?
          </p>
          <button
            onClick={() => navigate("/register")}
            className={styles.registerBtn}
          >
            Registrer deg
          </button>
        </div>
      </div>
    </div>
  );
}