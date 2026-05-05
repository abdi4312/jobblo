import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginIcon from "../../assets/images/Login/login-icon.png";
import { toast } from "react-hot-toast";
import SocialAuthButtons from "../../components/SocialAuthButtons/AuthButton.tsx";
import { Input } from "../../components/Ui/Input.tsx";
import { Button } from "../../components/Ui/Button.tsx";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Auth from "../../components/Auth/Auth.tsx";
import { useAuth } from "../../features/auth/hook/useAuth.ts";
import { useForm } from "../../hooks/useForm.ts";
import {
  loginValidationSchema,
  type LoginFormValues,
} from "../../validations/authValidations";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoggingIn } = useAuth();

  const { values, errors, handleChange, validate } = useForm<LoginFormValues>(
    {
      email: "",
      password: "",
    },
    loginValidationSchema,
  );

  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {
    if (!validate()) {
      toast.error("Vennligst fyll ut alle feltene riktig");
      return;
    }

    login({ email: values.email, password: values.password });
  };

  return (
    <>
      <div className="bg-white min-h-screen">
        <div className="flex mx-auto">
          <div className="w-[50%] relative 2xl:mix-h-236 min-h-screen overflow-hidden hidden lg:block">
            <Auth />
          </div>

          <div className=" w-full lg:w-[50%] 2xl:mt-29.25 mt-7 mx-3 lg:mx-0">
            <div className="flex flex-col text-center justify-center mb-2 2xl:mb-8.5">
              <div className="flex items-center justify-center">
                <img
                  src={LoginIcon}
                  alt="Login_icon"
                  className="max-w-22.5 max-h-9.75 object-cover"
                />
              </div>

              <div>
                <h1 className="text-3xl font-bold text-[#0E2A22]">Velkommen</h1>
                <p className="text-base font-normal text-[#4A5565]">
                  Logg inn til din Jobblo-konto
                </p>
              </div>
            </div>
            <div className="max-w-md mx-auto">
              <div className="flex flex-col gap-4 2xl:gap-6">
                <Input
                  label="E-post"
                  type="email"
                  value={values.email}
                  icon={<Mail size={20} className="text-[#99A1AF]" />}
                  placeholder="user1@jobblo.no"
                  onChange={(e) => handleChange("email", e.target.value)}
                  error={errors.email}
                  className="max-w-md"
                />
                <Input
                  label="Passord"
                  // Dynamic type toggle
                  type={showPassword ? "text" : "password"}
                  icon={<Lock size={20} className="text-[#99A1AF]" />}
                  value={values.password}
                  placeholder="••••••••"
                  onChange={(e) => handleChange("password", e.target.value)}
                  error={errors.password}
                  className="max-w-md"
                  // Right side icon logic
                  rightIcon={
                    <button
                      type="button"
                      className="cursor-pointer text-[#99A1AF] hover:text-gray-700 transition-colors"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  }
                />
              </div>

              <div className="flex flex-col gap-6.5 2xl:mt-6.5">
                <Button
                  className="bg-transparent text-[#83A790]! text-[14px]! py-0! font-normal! hover:bg-transparent"
                  label="Glemt passord? Klikk her"
                />
                <Button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className={`w-full max-w-md bg-custom-green! rounded-[14px] text-base! font-normal! ${isLoggingIn ? "opacity-80" : ""}`}
                  label={isLoggingIn ? "Logger inn..." : "Logg inn"}
                />
              </div>

              <div className="relative flex py-5 items-center">
                <div className="grow border-t border-[#E5E7EB]"></div>

                <span className="shrink mx-4 text-gray-400 text-sm font-normal">
                  eller
                </span>

                <div className="grow border-t border-[#E5E7EB]"></div>
              </div>

              <div>
                <SocialAuthButtons />
              </div>

              <div className="flex justify-center items-center pt-6 2xl:pt-11.5">
                <p>Har du ikke konto?</p>
                <Button
                  onClick={() => navigate("/register")}
                  className="bg-transparent! text-custom-green! p-0! text-base! font-normal!"
                  label="Registrer deg"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
