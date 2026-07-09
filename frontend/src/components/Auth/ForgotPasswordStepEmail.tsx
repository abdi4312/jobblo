import { ArrowLeft, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '../Ui/Input.tsx';
import { Button } from '../Ui/button/Button';

interface Props {
  email: string;
  emailError?: string;
  serverError?: string;
  isLoading: boolean;
  onEmailChange: (val: string) => void;
  onSubmit: () => void;
}

export default function ForgotPasswordStepEmail({
  email,
  emailError,
  serverError,
  isLoading,
  onEmailChange,
  onSubmit,
}: Props) {
  const navigate = useNavigate();

  return (
    <>
      <button
        type="button"
        onClick={() => navigate('/login')}
        className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-black transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        <span>Tilbake til innlogging</span>
      </button>

      <div className="mb-8">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Mail size={22} className="text-black" />
        </div>
        <h1 className="text-[28px] font-bold text-black leading-tight mb-2">
          Glemt passordet?
        </h1>
        <p className="text-base text-[#6B7280]">
          Skriv inn e-postadressen din. Vi sender deg en 6-sifret kode.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">
            E-postadresse
          </label>
          <Input
            type="email"
            value={email}
            placeholder="deg@eksempel.no"
            onChange={(e) => { onEmailChange(e.target.value); }}
            error={emailError || serverError}
            className="rounded-lg border-black focus:border-black placeholder:text-gray-400 h-12"
            onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          />
        </div>

        <Button
          onClick={onSubmit}
          loading={isLoading}
          className="py-3 rounded-lg font-bold"
          label="Send kode"
        />
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-[#6B7280]">
          Husker du passordet?{' '}
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="font-bold text-black hover:underline"
          >
            Logg inn
          </button>
        </p>
      </div>
    </>
  );
}