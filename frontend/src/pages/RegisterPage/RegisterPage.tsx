import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginIcon from "../../assets/images/Login/login-icon.png";
import { Input } from "../../components/Ui/Input.tsx";
import { Button } from "../../components/Ui/button/Button";
import SocialAuthButtons from "../../components/SocialAuthButtons/AuthButton.tsx";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import Auth from "../../components/Auth/Auth.tsx";
import { useAuth } from "../../features/auth/hook/useAuth.ts";
import { toast } from "react-hot-toast";
import {
  registerValidationSchema,
  type RegisterFormValues,
} from "../../validations/authValidations";
import { useForm } from "../../hooks/useForm.ts";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isRegistering } = useAuth();

  const { values, errors, handleChange, validate } =
    useForm<RegisterFormValues>(
      {
        name: "",
        lastName: "",
        email: "",
        password: "",
        confirmPassword: "",
      },
      registerValidationSchema,
    );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Vennligst rett feilene i skjemaet");
      return;
    }

    register({
      name: values.name,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
    });
  };

  return (
    <>
      <div className="bg-[#FFFFFF]! min-h-screen">
        <div className="flex mx-auto">
          <div className="w-[50%] relative 2xl:mix-h-236 min-h-screen overflow-hidden hidden lg:block">
            <Auth />
          </div>

          <div className="w-full lg:w-[50%] mt-29.25 mx-3 lg:mx-0">
            <div className="flex flex-col text-center justify-center mb-8.5">
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
                  Opprett din Jobblo-konto
                </p>
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <div className="flex flex-col gap-6">
                <Input
                  label="Fornavn"
                  type="text"
                  value={values.name}
                  icon={<User size={20} className="text-[#99A1AF]" />}
                  placeholder="Fornavn"
                  onChange={(e) => handleChange("name", e.target.value)}
                  error={errors.name}
                  className="max-w-md"
                />

                <Input
                  label="Etternavn"
                  type="text"
                  value={values.lastName}
                  icon={<User size={20} className="text-[#99A1AF]" />}
                  placeholder="Etternavn"
                  onChange={(e) => handleChange("lastName", e.target.value)}
                  error={errors.lastName}
                  className="max-w-md"
                />

                <Input
                  label="E-post"
                  type="email"
                  value={values.email}
                  icon={<Mail size={20} className="text-[#99A1AF]" />}
                  placeholder="bruker@jobblo.no"
                  onChange={(e) => handleChange("email", e.target.value)}
                  error={errors.email}
                  className="max-w-md"
                />

                <Input
                  label="Passord"
                  type={showPassword ? "text" : "password"}
                  icon={<Lock size={20} className="text-[#99A1AF]" />}
                  value={values.password}
                  placeholder="••••••••"
                  onChange={(e) => handleChange("password", e.target.value)}
                  error={errors.password}
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
                  value={values.confirmPassword}
                  placeholder="••••••••"
                  onChange={(e) =>
                    handleChange("confirmPassword", e.target.value)
                  }
                  error={errors.confirmPassword}
                  className="max-w-md"
                  rightIcon={
                    <div
                      className="cursor-pointer text-[#99A1AF] hover:text-gray-700 transition-colors"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={20} />
                      ) : (
                        <Eye size={20} />
                      )}
                    </div>
                  }
                />
              </div>

              <div className="flex flex-col gap-6.5 mt-6.5">
                <Button
                  onClick={handleRegister}
                  loading={isRegistering}
                  className="w-full max-w-md bg-custom-green! rounded-[14px] text-base! font-normal!"
                  label="Registrer"
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

              <div className="flex justify-center items-center pt-11.5">
                <p>Har du allerede en konto?</p>
                <Button
                  onClick={() => navigate("/login")}
                  className="bg-transparent! text-custom-green! p-0! text-base! font-normal!"
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
