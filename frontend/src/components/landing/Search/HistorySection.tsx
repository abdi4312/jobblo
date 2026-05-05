import { SearchItem } from "./SearchItem";
import type { HistoryItem } from "../../../hooks/useSearchHistory";

interface HistorySectionProps {
  history: HistoryItem[];
  onClear: () => void;
  onItemClick: (item: HistoryItem) => void;
}

export const HistorySection = ({
  history,
  onClear,
  onItemClick,
}: HistorySectionProps) => {
  return (
    <div className="pt-4">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[18px] font-bold text-[#1A1A1A]">Siste søk</h4>
        {history.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-[14px] font-bold text-custom-green hover:underline transition-all"
          >
            Tøm logg
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div className="space-y-4">
          {history.map((item) => (
            <SearchItem
              key={item.id}
              type={item.type}
              title={item.title}
              subtitle={item.subtitle}
              avatarUrl={item.avatarUrl}
              iconName={item.iconName}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      ) : (
        <div className="py-2">
          <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight">
            No search history
          </h3>
          <p className="text-[15px] text-gray-500 font-medium mt-1">
            Try searching for something
          </p>
        </div>
      )}
    </div>
  );
};
