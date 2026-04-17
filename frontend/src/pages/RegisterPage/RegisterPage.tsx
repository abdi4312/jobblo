import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginIcon from "../../assets/images/Login/login-icon.png";
import { Input } from "../../components/Ui/Input.tsx";
import { Button } from "../../components/Ui/Button.tsx";
import SocialAuthButtons from "../../components/SocialAuthButtons/AuthButton.tsx";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import Auth from "../../components/Auth/Auth.tsx";
import { useAuth } from "../../features/auth/hook/useAuth.ts";
import { toast } from "react-hot-toast";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isRegistering } = useAuth(); // Hook use karein
  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passordene matcher ikke");
      return;
    }

    if (!formData.name || !formData.email || !formData.password) {
      toast.error("Vennligst fyll ut alle feltene");
      return;
    }

    // TanStack mutation trigger karein
    register({
      name: formData.name,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password,
    });
  };

  const isFormValid =
    formData.name.trim() &&
    formData.lastName.trim() &&
    formData.email.trim() &&
    formData.password.trim() &&
    formData.confirmPassword.trim() &&
    formData.password === formData.confirmPassword;

  return (
    <>
      <div className="bg-[#FFFFFF]! min-h-screen">
        <div className="flex mx-auto">
          <div className='w-[50%] relative 2xl:mix-h-236 min-h-screen overflow-hidden hidden lg:block'>
            <Auth />
          </div>

          <div className="w-full lg:w-[50%] mt-29.25 mx-3 lg:mx-0">
            <div className="flex flex-col text-center justify-center mb-8.5">
              <div className="flex items-center justify-center">
                <img src={LoginIcon} alt="Login_icon" className="max-w-22.5 max-h-9.75 object-cover" />
              </div>

              <div>
                <h1 className="text-3xl font-bold text-[#0E2A22]">Velkommen</h1>
                <p className="text-base font-normal text-[#4A5565]">Opprett din Jobblo-konto</p>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <div className="flex flex-col gap-6">
                <Input
                  label="Fornavn"
                  type="text"
                  value={formData.name} // Koblet til skjema-state
                  icon={<User size={20} className="text-[#99A1AF]" />}
                  placeholder="Fornavn"
                  onChange={(e) => handleInputChange("name", e.target.value)} // State-oppdateringslogikk
                  className="max-w-md"
                />

                <Input
                  label="Etternavn"
                  type="text"
                  value={formData.lastName} // Koblet til skjema-state
                  icon={<User size={20} className="text-[#99A1AF]" />}
                  placeholder="Etternavn"
                  onChange={(e) => handleInputChange("lastName", e.target.value)} // State-oppdateringslogikk
                  className="max-w-md"
                />

                <Input
                  label="E-post"
                  type="email"
                  value={formData.email} // Koblet til skjema-state
                  icon={<Mail size={20} className="text-[#99A1AF]" />}
                  placeholder="bruker@jobblo.no"
                  onChange={(e) => handleInputChange("email", e.target.value)} // State-oppdateringslogikk
                  className="max-w-md"
                />

                <Input
                  label="Passord"
                  type={showPassword ? "text" : "password"}
                  icon={<Lock size={20} className="text-[#99A1AF]" />}
                  value={formData.password} // Koblet til skjema-state
                  placeholder="••••••••"
                  onChange={(e) => handleInputChange("password", e.target.value)}
                  className="max-w-md"
                  rightIcon={
                    <div
                      className="cursor-pointer text-[#99A1AF] hover:text-gray-700 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  }
                />

                <Input
                  label="Bekreft passord"
                  type={showConfirmPassword ? "text" : "password"}
                  icon={<Lock size={20} className="text-[#99A1AF]" />}
                  value={formData.confirmPassword} // Koblet til skjema-state
                  placeholder="••••••••"
                  onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                  className="max-w-md"
                  rightIcon={
                    <div
                      className="cursor-pointer text-[#99A1AF] hover:text-gray-700 transition-colors"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  }
                />
              </div>

              <div className="flex flex-col gap-6.5 mt-6.5">
                <Button
                  onClick={handleRegister}
                  disabled={!isFormValid || isRegistering}
                  className={`w-full max-w-md bg-[#2F7E47]! rounded-[14px] text-base! font-normal! ${(!isFormValid || isRegistering) ? "opacity-80" : ""}`}
                  label={isRegistering ? "Registrerer..." : "Registrer"}
                />
              </div>

              <div className="relative flex py-5 items-center">
                <div className="grow border-t border-[#E5E7EB]"></div>
                <span className="shrink mx-4 text-gray-400 text-sm font-normal">eller</span>
                <div className="grow border-t border-[#E5E7EB]"></div>
              </div>

              <div>
                <SocialAuthButtons />
              </div>

              <div className="flex justify-center items-center pt-11.5">
                <p>Har du allerede en konto?</p>
                <Button
                  onClick={() => navigate("/login")}
                  className="bg-transparent! text-[#2F7E47]! p-0! text-base! font-normal!"
                  label="Logg inn"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
