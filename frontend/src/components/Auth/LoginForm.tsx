import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import LoginIcon from '../../assets/images/Login/login-icon.png';
import SocialAuthButtons from '../SocialAuthButtons/AuthButton.tsx';
import { Input } from '../Ui/Input.tsx';
import { Button } from '../Ui/button/Button';
import { useAuth } from '../../features/auth/hook/useAuth.ts';
import { useForm } from '../../hooks/useForm.ts';
import { loginValidationSchema, type LoginFormValues } from '../../validations/authValidations';

export const LoginForm = () => {
  const navigate = useNavigate();
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { values, errors, handleChange, validate } = useForm<LoginFormValues>(
    {
      email: '',
      password: '',
    },
    loginValidationSchema
  );

  const handleLogin = () => {
    if (!validate()) {
      toast.error('Vennligst fyll ut alle felt riktig');
      return;
    }

    login({ email: values.email, password: values.password });
  };

  return (
    <div className="w-full lg:w-[50%] flex items-center justify-center p-4">
      <div className="w-full max-w-120 p-8">
        <div className="mb-8">
          <h1 className="text-[28px] font-bold text-black leading-tight mb-2">Finn en ekspert</h1>
          <p className="text-base text-[#6B7280]">
            Logg inn for å legge ut oppdrag eller tilby dine ferdigheter.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* Email Input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
              E-postadresse
            </label>
            <Input
              type="email"
              value={values.email}
              placeholder="deg@eksempel.no"
              onChange={(e) => handleChange('email', e.target.value)}
              error={errors.email}
              className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
            />
          </div>

          {/* Password Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
                Passord
              </label>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-[12px] font-bold text-black uppercase tracking-wider hover:underline"
              >
                Glemt?
              </button>
            </div>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={values.password}
              placeholder="Ditt passord"
              onChange={(e) => handleChange('password', e.target.value)}
              error={errors.password}
              className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
              rightIcon={
                <button
                  type="button"
                  className="text-gray-400 hover:text-black transition-colors"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              }
            />
          </div>

          {/* Remember Me */}
          {/* <div className="flex items-center gap-3 mt-1">
            <div
              className={`w-5 h-5 rounded-full border border-black flex items-center justify-center cursor-pointer ${
                rememberMe ? "bg-black" : "bg-white"
              }`}
              onClick={() => setRememberMe(!rememberMe)}
            >
              {rememberMe && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <span className="text-sm text-[#4B5563]">Husk meg i 30 dager</span>
          </div> */}

          {/* Sign In Button */}
          <Button
            onClick={handleLogin}
            loading={isLoggingIn}
            // className="w-full h-12 bg-black text-white rounded-lg font-bold text-base hover:bg-black/90 transition-all mt-2"
            className="py-3 rounded-lg font-bold"
            label="Logg inn"
          />

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-gray-200"></div>
            <span className="shrink mx-4 text-gray-400 text-sm font-normal">eller</span>
            <div className="grow border-t border-gray-200"></div>
          </div>

          <div>
            <SocialAuthButtons />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-[#6B7280]">
            Har du ikke konto?{' '}
            <button
              onClick={() => navigate('/register')}
              className="font-bold text-black hover:underline"
            >
              Opprett en gratis
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
