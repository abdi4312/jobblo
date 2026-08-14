import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}

/**
 * The hero search bar. Squared off to `rounded-xl` and put on the same 46 px control
 * height as the auth fields and every button on the site — it was a pill with a pill
 * button inside, the only rounded-full control on the page.
 */
export const SearchInput = ({ value, onChange, onFocus }: SearchInputProps) => {
  return (
    <div className="flex h-13 max-w-120 items-center rounded-xl border border-[#E6E7E1] bg-white pl-4 pr-1.5 transition focus-within:border-[#2E6641]/35 focus-within:ring-4 focus-within:ring-[#2E6641]/12">
      <Search size={17} strokeWidth={2.1} className="mr-2.5 shrink-0 text-[#9B9E96]" />
      <input
        type="text"
        className="min-w-0 flex-1 border-none bg-transparent text-[0.9375rem] text-[#0B0B0B] outline-none placeholder:text-[#9B9E96]"
        placeholder="Hva leter du etter?"
        aria-label="Søk etter oppdrag"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
      <button
        type="button"
        className="ml-2 flex h-10 shrink-0 items-center rounded-lg bg-[#2E6641] px-5 text-[0.875rem] font-semibold text-white transition duration-150 hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/20"
      >
        Søk
      </button>
    </div>
  );
};
