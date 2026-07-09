import { useRef } from 'react';
import type { KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  /** Called automatically when all 6 digits are filled */
  onComplete?: () => void;
  disabled?: boolean;
}

export default function OtpInput({ value, onChange, onComplete, disabled }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const focus = (i: number) => inputs.current[i]?.focus();

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        const next = [...digits];
        next[i] = '';
        onChange(next.join(''));
      } else if (i > 0) {
        focus(i - 1);
      }
    }
  };

  const handleChange = (char: string, i: number) => {
    const sanitized = char.replace(/\D/g, '').slice(-1);
    if (!sanitized) return;
    const next = [...digits];
    next[i] = sanitized;
    const newValue = next.join('');
    onChange(newValue);

    if (i < 5) {
      focus(i + 1);
    } else if (newValue.replace(/\s/g, '').length === 6) {
      // Last digit filled — trigger auto-submit
      onComplete?.();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      const padded = pasted.padEnd(6, '').slice(0, 6);
      onChange(padded);
      focus(Math.min(pasted.length - 1, 5));
      // Auto-submit if paste fills all 6 digits
      if (pasted.length === 6) {
        onComplete?.();
      }
    }
    e.preventDefault();
  };

  return (
    <div className="flex justify-center gap-3" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-label={`OTP siffer ${i + 1}`}
          onChange={(e) => handleChange(e.target.value, i)}
          onKeyDown={(e) => handleKey(e, i)}
          className={[
            'w-12 h-14 text-center text-[22px] font-bold rounded-xl border-2 outline-none transition-all',
            'focus:border-black focus:ring-2 focus:ring-black/10',
            disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : '',
            d ? 'border-black bg-gray-50' : 'border-gray-200 bg-white',
          ].join(' ')}
        />
      ))}
    </div>
  );
}