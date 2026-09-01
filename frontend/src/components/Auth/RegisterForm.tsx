import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
import SocialAuthButtons from '../SocialAuthButtons/AuthButton.tsx';
import AuthField from './AuthField.tsx';
import PasswordChecklist from './PasswordChecklist.tsx';
import { FIELD_ICON_BUTTON, PRIMARY_BUTTON, TEXT_LINK } from './authStyles.ts';
import { useAuth } from '../../features/auth/hook/useAuth.ts';
import { useForm } from '../../hooks/useForm.ts';
import { getErrorMessage } from '../../utils/getErrorMessage.ts';
import {
  registerValidationSchema,
  type RegisterFormValues,
} from '../../validations/authValidations';

/**
 * Registration in two steps: who you are, then how you sign in.
 *
 * As one page it was eight fields deep and always ran past the fold on a phone, so the
 * submit button sat below a scroll the user had no reason to expect. Split, each step
 * fits the viewport, the form asks one thing at a time, and step one leads with Vipps —
 * where most Norwegian users finish in a tap and never see step two.
 */
type Step = 'identity' | 'credentials';

export const RegisterForm = () => {
  const { register, isRegistering } = useAuth();
  const [step, setStep] = useState<Step>('identity');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState('');

  const { values, errors, handleChange, validate, setErrors } = useForm<RegisterFormValues>(
    {
      name: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      companyName: '',
      orgNumber: '',
    },
    registerValidationSchema
  );

  const isCompany = values.role === 'company';

  /**
   * Validates only the fields belonging to the current step, reusing the shared schema
   * so the messages stay in one place. `validate()` checks everything, which on step one
   * would flag the email and password the user has not reached yet.
   */
  const validateFields = (fields: Array<keyof RegisterFormValues>) => {
    const stepErrors: Partial<Record<keyof RegisterFormValues, string>> = {};

    fields.forEach((field) => {
      const rules = registerValidationSchema[field as keyof typeof registerValidationSchema];
      if (!rules) return;
      for (const rule of rules) {
        if (!rule.test(values)) {
          stepErrors[field] = rule.message;
          break;
        }
      }
    });

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const fields: Array<keyof RegisterFormValues> = isCompany
      ? ['role', 'companyName', 'orgNumber']
      : ['role', 'name', 'lastName'];

    if (!validateFields(fields)) return;
    setStep('credentials');
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setServerError('');

    register(
      {
        name: values.name,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        role: values.role,
        ...(isCompany && {
          companyName: values.companyName,
          orgNumber: values.orgNumber,
        }),
      },
      {
        onError: (error: unknown) =>
          setServerError(getErrorMessage(error, 'Registreringen mislyktes. Prøv igjen.')),
      }
    );
  };

  const passwordToggle = (visible: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? 'Skjul passord' : 'Vis passord'}
      className={FIELD_ICON_BUTTON}
    >
      {visible ? <EyeOff size={17} /> : <Eye size={17} />}
    </button>
  );

  return (
    <div>
      {/* Step marker: two rules, the active one filled. Cheaper to read at a glance
          than "Steg 1 av 2" alone, and it shows there is an end to this. */}
      <div className="flex items-center gap-2">
        <span className="h-0.75 w-7 rounded-full bg-[#2E6641]" />
        <span
          className={`h-0.75 w-7 rounded-full transition-colors duration-200 ${
            step === 'credentials' ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
          }`}
        />
        <span className="ml-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[#9B9E96]">
          Steg {step === 'identity' ? '1' : '2'} av 2
        </span>
      </div>

      <h1 className="mt-4 text-[1.625rem] font-bold leading-tight tracking-[-0.025em] text-[#0B0B0B]">
        {step === 'identity' ? 'Opprett konto' : 'Sikre kontoen din'}
      </h1>
      <p className="mt-1.5 text-[0.875rem] leading-relaxed text-[#63665F]">
        {step === 'identity'
          ? 'Gratis å opprette. Legg ut oppdrag eller tilby tjenestene dine.'
          : 'Velg e-posten og passordet du logger inn med.'}
      </p>

      {step === 'identity' ? (
        <>
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

          <form onSubmit={handleContinue} noValidate className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-1.75 text-[0.8125rem] font-medium text-[#0B0B0B]">
                Jeg er
              </legend>

              <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-[#F0F1EB] p-1">
                {/* The moving pill — one transform, so the switch animates on the GPU. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.375rem)] rounded-[10px] bg-white shadow-[0_1px_3px_rgba(15,31,22,0.12)] transition-transform duration-200 ease-out"
                  style={{ transform: isCompany ? 'translateX(calc(100% + 0.25rem))' : 'none' }}
                />
                {(
                  [
                    { value: 'user', label: 'Privatperson' },
                    { value: 'company', label: 'Firma' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={values.role === option.value}
                    onClick={() => handleChange('role', option.value)}
                    className={`relative z-10 h-9.5 rounded-[10px] text-[0.875rem] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25 ${
                      values.role === option.value ? 'text-[#0B0B0B]' : 'text-[#63665F]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            {isCompany ? (
              <>
                <AuthField
                  label="Bedriftsnavn"
                  name="organization"
                  autoComplete="organization"
                  placeholder="F.eks. Nordmann Bygg AS"
                  value={values.companyName ?? ''}
                  error={errors.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                />
                <AuthField
                  label="Organisasjonsnummer"
                  name="orgNumber"
                  inputMode="numeric"
                  maxLength={9}
                  placeholder="9 siffer"
                  value={values.orgNumber ?? ''}
                  error={errors.orgNumber}
                  onChange={(e) =>
                    handleChange('orgNumber', e.target.value.replace(/\D/g, '').slice(0, 9))
                  }
                />
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <AuthField
                  label="Fornavn"
                  name="given-name"
                  autoComplete="given-name"
                  placeholder="Ola"
                  value={values.name}
                  error={errors.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
                <AuthField
                  label="Etternavn"
                  name="family-name"
                  autoComplete="family-name"
                  placeholder="Nordmann"
                  value={values.lastName}
                  error={errors.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                />
              </div>
            )}

            <button type="submit" className={`mt-2 ${PRIMARY_BUTTON}`}>
              Fortsett
            </button>
          </form>
        </>
      ) : (
        <form onSubmit={handleRegister} noValidate className="mt-7 flex flex-col gap-4">
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

          <div className="flex flex-col gap-2.5">
            <AuthField
              label="Passord"
              type={showPassword ? 'text' : 'password'}
              name="new-password"
              autoComplete="new-password"
              placeholder="Velg et passord"
              value={values.password}
              error={errors.password}
              onChange={(e) => handleChange('password', e.target.value)}
              trailing={passwordToggle(showPassword, () => setShowPassword((p) => !p))}
            />
            <PasswordChecklist value={values.password} />
          </div>

          <AuthField
            label="Bekreft passord"
            type={showConfirmPassword ? 'text' : 'password'}
            name="confirm-password"
            autoComplete="new-password"
            placeholder="Skriv passordet på nytt"
            value={values.confirmPassword}
            error={errors.confirmPassword}
            onChange={(e) => handleChange('confirmPassword', e.target.value)}
            trailing={passwordToggle(showConfirmPassword, () => setShowConfirmPassword((p) => !p))}
          />

          <button type="submit" disabled={isRegistering} className={`mt-2 ${PRIMARY_BUTTON}`}>
            {isRegistering && <Loader2 size={16} className="animate-spin" />}
            {isRegistering ? 'Oppretter konto…' : 'Opprett konto'}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep('identity');
              setServerError('');
            }}
            className="mx-auto flex items-center gap-1.5 rounded text-[0.8125rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
          >
            <ArrowLeft size={14} />
            Tilbake
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-[0.875rem] text-[#63665F]">
        Har du allerede konto?{' '}
        <Link to="/login" className={TEXT_LINK}>
          Logg inn
        </Link>
      </p>
    </div>
  );
};
