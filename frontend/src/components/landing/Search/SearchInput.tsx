import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}

export const SearchInput = ({ value, onChange, onFocus }: SearchInputProps) => {
  return (
    <div className="flex items-center bg-white border border-black/15 rounded-full p-1.5 pl-4.5 max-w-[480px]">
      <Search size={18} className="text-black/40 mr-2.5" />
      <input
        type="text"
        className="flex-1 border-none bg-transparent text-[14px] text-custom-black outline-none placeholder:text-black/40"
        placeholder="Hva leter du etter?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
      />
      <button className="px-5 py-2.5 bg-custom-green text-white rounded-full text-[13px] font-medium cursor-pointer hover:bg-[#25633a] transition-colors whitespace-nowrap ml-2">
        Søk
      </button>
    </div>
  );
};
