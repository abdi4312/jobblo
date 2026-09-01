import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import SocialAuthButtons from '../SocialAuthButtons/AuthButton.tsx';
import AuthField from './AuthField.tsx';
import { FIELD_ICON_BUTTON, PRIMARY_BUTTON, TEXT_LINK } from './authStyles.ts';
import { useAuth } from '../../features/auth/hook/useAuth.ts';
import { useForm } from '../../hooks/useForm.ts';
import { getErrorMessage } from '../../utils/getErrorMessage.ts';
import { loginValidationSchema, type LoginFormValues } from '../../validations/authValidations';
import { oauthErrorMessage } from '../../features/auth/oauthErrors.ts';

export const LoginForm = () => {
  const navigate = useNavigate();
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [searchParams] = useSearchParams();

  // Vipps and Google redirect here with ?error=<code> when they refuse a sign-in.
  // Nothing read it before, so the person landed on a blank form with no idea why.
  const oauthError = oauthErrorMessage(searchParams.get('error'));

  const { values, errors, handleChange, validate } = useForm<LoginFormValues>(
    { email: '', password: '' },
    loginValidationSchema
  );

  const handleLogin = (e: React.FormEvent) => {
    // A real <form> so Enter submits and password managers recognise the pair.
    e.preventDefault();
    if (!validate()) return;
    setServerError('');

    login(
      { email: values.email, password: values.password },
      {
        // getErrorMessage handles both backend error shapes. The old read was
        // `err.response?.data?.error`, which hands the object-shaped envelope from the
        // Express error handler straight to React as a child — a white screen on
        // exactly the request the user most needs to work.
        onError: (error: unknown) =>
          setServerError(getErrorMessage(error, 'Innlogging mislyktes. Sjekk e-post og passord.')),
      }
    );
  };

  return (
    <div>
      <h1 className="text-[1.625rem] font-bold leading-tight tracking-[-0.025em] text-[#0B0B0B]">
        Velkommen tilbake
      </h1>
      <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[#63665F]">
        Logg inn for å legge ut oppdrag eller finne ditt neste.
      </p>

      <div className="mt-7">
        <SocialAuthButtons />
      </div>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[#E6E7E1]" />
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">
          eller
        </span>
        <span className="h-px flex-1 bg-[#E6E7E1]" />
      </div>

      <form onSubmit={handleLogin} noValidate className="flex flex-col gap-4">
        {oauthError && !serverError && (
          <p
            role="alert"
            className="rounded-xl bg-[#FCF4F3] px-3.5 py-2.5 text-[0.8125rem] leading-snug text-[#B0453B]"
          >
            {oauthError}
          </p>
        )}

        {serverError && (
          <p
            role="alert"
            className="rounded-xl bg-[#FCF4F3] px-3.5 py-2.5 text-[0.8125rem] leading-snug text-[#B0453B]"
          >
            {serverError}
          </p>
        )}

        <AuthField
          label="E-postadresse"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="deg@eksempel.no"
          value={values.email}
          error={errors.email}
          onChange={(e) => {
            handleChange('email', e.target.value);
            setServerError('');
          }}
        />

        <AuthField
          label="Passord"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          placeholder="Ditt passord"
          value={values.password}
          error={errors.password}
          onChange={(e) => {
            handleChange('password', e.target.value);
            setServerError('');
          }}
          labelAction={
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className={`text-[0.78125rem] ${TEXT_LINK}`}
            >
              Glemt passord?
            </button>
          }
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Skjul passord' : 'Vis passord'}
              className={FIELD_ICON_BUTTON}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          }
        />

        <button type="submit" disabled={isLoggingIn} className={`mt-2 ${PRIMARY_BUTTON}`}>
          {isLoggingIn && <Loader2 size={16} className="animate-spin" />}
          {isLoggingIn ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>

      <p className="mt-6 text-center text-[0.875rem] text-[#63665F]">
        Ny på Jobblo?{' '}
        <Link to="/register" className={TEXT_LINK}>
          Opprett gratis konto
        </Link>
      </p>
    </div>
  );
};
