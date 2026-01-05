import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "../../assets/icons";
import { toast } from "react-toastify";
import styles from "./RegisterPage.module.css";
import { registerUser } from "../../api/userAPI.ts";
import axios from "axios";
import SocialAuthButtons from "../../components/SocialAuthButtons/AuthButton.tsx";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleRegister = async () => {
    if (formData.password !== formData.confirmPassword) {
      toast.error("Passordene matcher ikke");
      return;
    }

    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Vennligst fyll ut alle feltene");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      toast.success("Registrering vellykket!");
      navigate("/");
    } catch (error) {
      console.error("Error registering:", error);
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401)
          toast.error("En bruker med denne e-posten eksisterer allerede");
      } else {
        toast.error("Kunne ikke registrere bruker");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Register Card */}
      <div className={styles.card}>
        {/* Title */}
        <h2 className={styles.title}>Registrer deg til</h2>

        {/* Jobblo Logo */}
        <div className={styles.logo}>
          <Icons.JobbloIcon />
        </div>

        {/* Name Fields */}
        <input
          type="text"
          placeholder="Fornavn"
          value={formData.name}
          onChange={(e) => handleInputChange("name", e.target.value)}
          className={styles.input}
        />

        {/* Email Input */}
        <input
          type="email"
          placeholder="E-post"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          className={styles.input}
        />

        {/* Password Input */}
        <input
          type="password"
          placeholder="Passord"
          value={formData.password}
          onChange={(e) => handleInputChange("password", e.target.value)}
          className={styles.input}
        />

        {/* Confirm Password Input */}
        <input
          type="password"
          placeholder="Bekreft passord"
          value={formData.confirmPassword}
          onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
          className={styles.input}
        />

        {/* Info Text */}
        <p className={styles.infoText}>
          Ved å registrere deg godtar du våre{" "}
          <a href="#" className={styles.link}>
            vilkår og betingelser
          </a>{" "}
          og{" "}
          <a href="#" className={styles.link}>
            personvernregler
          </a>
          .
        </p>

        {/* Register Button */}
        <button
          onClick={handleRegister}
          disabled={loading}
          className={`${styles.registerBtn} ${loading ? styles.registerBtnDisabled : ""}`}
        >
          {loading ? "Registrerer..." : "Registrer deg"}
        </button>

        {/* Cancel Link */}
        <button onClick={() => navigate(-1)} className={styles.cancelBtn}>
          Avbryt
        </button>

        {/* Social Auth Buttons */}
        <SocialAuthButtons />

        {/* Login Section */}
        <div className={styles.loginSection}>
          <p className={styles.loginText}>Har du allerede en konto?</p>
          <button
            onClick={() => navigate("/login")}
            className={styles.loginBtn}
          >
            Logg inn
          </button>
        </div>
      </div>

      {/* Language Selector */}
      <div className={styles.languageSelector}>
        <select className={styles.select}>
          <option value="EN">EN</option>
          <option value="NO">NO</option>
        </select>
      </div>
    </div>
  );
}
