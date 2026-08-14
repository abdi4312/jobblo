import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

/**
 * The input used across the auth screens.
 *
 * Deliberately not the shared `Ui/Input`: that one hard-codes `max-h-10.75`, so the
 * `h-12` the auth forms passed it was silently ignored and every field rendered at
 * 43 px — under the 44 px minimum touch target, and the reason the old form felt
 * cramped. Fixing the shared component would touch every form in the app, so the auth
 * screens get their own field instead.
 *
 * The field rests on a quiet grey surface and lifts to white with a dark ring on focus,
 * so the active row is unmistakable without a heavy border in the resting state. The
 * label is tied to the input by id, the error is announced through `aria-describedby`,
 * and `autoComplete` passes straight through so password managers and iOS/Android
 * autofill work — none of which the previous markup did.
 */
type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Rendered inside the field on the right — the password visibility toggle. */
  trailing?: ReactNode;
  /** Rendered opposite the label, e.g. the "Glemt passord?" link. */
  labelAction?: ReactNode;
};

export default function AuthField({
  label,
  error,
  trailing,
  labelAction,
  className = '',
  id,
  ...props
}: AuthFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = `${fieldId}-error`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={fieldId} className="text-[0.8125rem] font-medium text-[#0B0B0B]">
          {label}
        </label>
        {labelAction}
      </div>

      <div className="relative">
        <input
          {...props}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`
            h-11.5 w-full rounded-xl border bg-[#F5F6F1] px-3.5 text-[0.9375rem] text-[#0B0B0B]
            outline-none transition duration-150
            placeholder:text-[#9B9E96]
            focus:border-[#2E6641]/35 focus:bg-white focus:ring-4 focus:ring-[#2E6641]/12
            disabled:cursor-not-allowed disabled:opacity-60
            ${trailing ? 'pr-11' : ''}
            ${error ? 'border-[#D8B0AB] bg-[#FCF5F4]' : 'border-transparent'}
            ${className}
          `}
        />

        {trailing && (
          <span className="absolute inset-y-0 right-1 flex items-center">{trailing}</span>
        )}
      </div>

      {error && (
        <p id={errorId} className="text-[0.78125rem] leading-snug text-[#B0453B]">
          {error}
        </p>
      )}
    </div>
  );
}
