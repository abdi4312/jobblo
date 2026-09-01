import { Check } from 'lucide-react';

/**
 * Shows the password rules as they are met, instead of failing the user after they
 * press "Opprett konto".
 *
 * The three checks mirror `validationLogic.isStrongPassword` exactly — 8 characters,
 * upper *and* lower case, and a digit. If that rule ever changes, change it here too;
 * showing requirements the validator does not enforce, or hiding ones it does, is worse
 * than showing nothing.
 */
const PASSWORD_RULES = [
  { id: 'length', label: 'Minst 8 tegn', test: (v: string) => v.length >= 8 },
  {
    id: 'case',
    label: 'Stor og liten bokstav',
    test: (v: string) => /[A-Z]/.test(v) && /[a-z]/.test(v),
  },
  { id: 'digit', label: 'Minst ett tall', test: (v: string) => /[0-9]/.test(v) },
];

type PasswordChecklistProps = {
  value: string;
};

export default function PasswordChecklist({ value }: PasswordChecklistProps) {
  const met = PASSWORD_RULES.filter((rule) => rule.test(value)).length;

  return (
    <div className="flex flex-col gap-2.5">
      {/* Strength as three segments rather than a percentage — it maps one-to-one onto
          the rules below, so the bar and the list can never disagree. */}
      <div className="flex gap-1" aria-hidden="true">
        {PASSWORD_RULES.map((rule, i) => (
          <span
            key={rule.id}
            className={`h-0.75 flex-1 rounded-full transition-colors duration-200 ${
              i < met ? 'bg-[#2E6641]' : 'bg-[#E6E7E1]'
            }`}
          />
        ))}
      </div>

      <ul className="flex flex-wrap gap-x-3.5 gap-y-1">
        {PASSWORD_RULES.map((rule) => {
          const ok = rule.test(value);
          return (
            <li
              key={rule.id}
              className={`flex items-center gap-1 text-[0.75rem] transition-colors ${
                ok ? 'text-[#2E6641]' : 'text-[#9B9E96]'
              }`}
            >
              <Check size={12} strokeWidth={ok ? 3 : 2} className={ok ? '' : 'opacity-40'} />
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
