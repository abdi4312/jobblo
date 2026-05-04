import { Search } from "lucide-react";
import { Input as AppInput } from "../../Ui/Input";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
}

export const SearchInput = ({ value, onChange, onFocus }: SearchInputProps) => {
  return (
    <div className="gap-3 p-3 bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 w-full md:min-w-137.5 lg:min-w-162.5 transition-all duration-300">
      <div className="flex">
        <AppInput
          className="bg-transparent! outline-none! border-0 text-[20px] pl-12.5 w-full placeholder:text-gray-900"
          placeholder="Hva leter du etter?"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          icon={<Search size={25} color="#0A0A0A" />}
        />
      </div>
    </div>
  );
};
