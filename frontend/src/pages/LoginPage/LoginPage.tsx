import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Icons from "../../assets/icons";
import { toast } from "react-toastify";
import styles from "./loginPage.module.css";
import { userLogin } from "../../api/userAPI.ts";
import axios from "axios";
import SocialAuthButtons from "../../components/SocialAuthButtons/AuthButton.tsx";

export default function LoginPage() {
  const navigate = useNavigate();
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
      const response = await userLogin(email, password);

      const data = response.data;
      toast.success("Innlogging vellykket!");
      navigate("/");
    } catch (error) {
      console.error("Error logging in:", error);

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          toast.error("Feil e-post eller passord");
        } else {
          toast.error("Kunne ikke logge inn");
        }
      } else {
        toast.error("Kunne ikke koble til server");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.leftSide}>
          <img
            className={styles.loginnimg}
            src="src/assets/images/loginnstandardimg.png"
            alt="Jobblo logo with tools in the background"
          />
        </div>
        
        <div className={styles.rightSide}>
          <div className={styles.wrapper}>
            {/* Vipps Logo */}
            <div className={styles.vippsLogo}>Velkommen</div>

            {/* Login Card */}
            <div className={styles.card}>
              {/* Title */}
              <h2 className={styles.title}>Log in to</h2>

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
                disabled={loading || !email || !password}
                className={styles.loginBtn}
              >
                {loading ? "Logger inn..." : "Logg inn"}
              </button>

              {/* Cancel Link */}
              {/*<button onClick={() => navigate(-1)} className={styles.cancelBtn}>
                Cancel
              </button>*/}

              <div className={styles.orSeparator}>
                <span>eller</span>
              </div>


              {/* Social Auth Buttons */}
              <SocialAuthButtons />
              

              {/* Register Section */}
              <div className={styles.registerSection}>
                <p className={styles.registerText}>Har du ikke en konto?</p>
                <button
                  onClick={() => navigate("/register")}
                  className={styles.registerBtn}
                >
                  Registrer deg
                </button>
              </div>
            </div>
          </div>
        </div>
    </div>

            
  );
}
