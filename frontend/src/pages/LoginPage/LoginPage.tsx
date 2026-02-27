import { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginIcon from "../../assets/images/Login/login-icon.png";
import { toast } from "react-toastify";
import SocialAuthButtons from "../../components/SocialAuthButtons/AuthButton.tsx";
import { Input } from "../../components/Ui/Input.tsx";
import { Button } from "../../components/Ui/Button.tsx";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import Auth from "../../components/Auth/Auth.tsx";
import { useLogin } from "../../features/auth/hook/useLogin.ts";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // TanStack Hook ka istemal
  const { mutate: login, isPending } = useLogin();

  const handleLogin = () => {
    if (!email || !password) {
      toast.error("Vennligst fyll ut alle feltene");
      return;
    }

    // Hook se mutate function call karein
    login({ email, password });
  };

  return (
    <>
      <div className="bg-white min-h-screen">
        <div className="flex max-w-390.5 mx-auto">
          <div className='w-[50%] relative 2xl:mix-h-236 min-h-screen overflow-hidden hidden lg:block'>
            <Auth />
          </div>

          <div className=" w-full lg:w-[50%] 2xl:mt-29.25 mt-7 mx-3 lg:mx-0">
            <div className="flex flex-col text-center justify-center mb-2 2xl:mb-8.5">
              <div className="flex items-center justify-center">
                <img src={LoginIcon} alt="Login_icon" className="max-w-22.5 max-h-9.75 object-cover" />
              </div>

              <div>
                <h1 className="text-3xl font-bold text-[#0E2A22]">Velkommen</h1>
                <p className="text-base font-normal text-[#4A5565]">Logg inn til din Jobblo-konto</p>
              </div>
            </div>
            <div className="max-w-md mx-auto">
              <div className="flex flex-col gap-4 2xl:gap-6">
                <Input
                  label="E-post"
                  type="email"
                  value={email}
                  icon={<Mail size={20} className="text-[#99A1AF]" />}
                  placeholder="user1@jobblo.no"
                  onChange={(e) => setEmail(e.target.value)}
                  className="max-w-md"
                />
                <Input
                  label="Passord"
                  // Dynamic type toggle
                  type={showPassword ? "text" : "password"}
                  icon={<Lock size={20} className="text-[#99A1AF]" />}
                  value={password}
                  placeholder="••••••••"
                  onChange={(e) => setPassword(e.target.value)}
                  className="max-w-md"
                  // Right side icon logic
                  rightIcon={
                    <div
                      className="cursor-pointer text-[#99A1AF] hover:text-gray-700 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  }
                />
              </div>

              <div className="flex flex-col gap-6.5 2xl:mt-6.5">
                <Button
                  // onClick={handleLogin}
                  // loading={loading}
                  className="bg-transparent text-[#83A790]! text-[14px]! py-0! font-normal! hover:bg-transparent"
                  label="Glemt passord? Klikk her"
                />
                <Button
                  onClick={handleLogin}
                  disabled={isPending}
                  className="w-full max-w-md bg-[#3F8F6B]! rounded-[14px] text-base! font-normal!"
                  label={isPending ? "Logger inn..." : "Logg inn"}
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
                  className="bg-transparent! text-[#3F8F6B]! p-0! text-base! font-normal!"
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
