import { User, Tag, HelpCircle } from "lucide-react";
import * as Icons from "lucide-react";

interface SearchItemProps {
  type: "query" | "user" | "category" | "list";
  title: string;
  subtitle?: string;
  avatarUrl?: string;
  iconName?: string;
  image?: string;
  onClick: () => void;
  count?: number;
  isPublic?: boolean;
}

export const SearchItem = ({
  type,
  title,
  subtitle,
  avatarUrl,
  iconName,
  image,
  onClick,
  count,
  isPublic,
}: SearchItemProps) => {
  const renderIcon = () => {
    if (type === "user") {
      return (
        <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <User className="text-gray-400" size={24} />
            </div>
          )}
        </div>
      );
    }

    if (type === "category") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const LucideIcon = (Icons as any)[iconName || ""] || HelpCircle;
      return (
        <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center flex-shrink-0">
          <LucideIcon size={24} className="text-[#2F7E47]" strokeWidth={1.5} />
        </div>
      );
    }

    if (type === "list") {
      return (
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
          {image ? (
            <img src={image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100">
              <Tag className="text-gray-400" size={20} />
            </div>
          )}
        </div>
      );
    }

    // Default query type
    return (
      <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] flex items-center justify-center shrink-0">
        <Icons.Search
          size={24}
          className="text-gray-900 group-hover:text-[#2F7E47] transition-colors"
          strokeWidth={1.5}
        />
      </div>
    );
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-2xl cursor-pointer transition-all group"
    >
      {renderIcon()}
      <div>
        <h3 className="text-[17px] font-bold text-[#1A1A1A] leading-tight group-hover:text-[#2F7E47] transition-colors">
          {title}
        </h3>
        <p className="text-[15px] text-gray-500 font-medium mt-1">
          {type === "list" ? `${count || 0} oppdrag · ${isPublic ? "Offentlig" : "Privat"}` : subtitle}
        </p>
      </div>
    </div>
  );
};
