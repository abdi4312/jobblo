import {
  LayoutGrid,
  Bookmark,
  Briefcase,
  Star,
  Clock,
  User,
  Award,
} from "lucide-react";
import { useUserStore } from "../../../stores/userStore";

interface ProfileNavProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
  isOwnProfile?: boolean;
  profileType?: "seeker" | "poster";
  userRole?: string;
}

export function ProfileNav({
  activeTab,
  onTabChange,
  isOwnProfile = false,
  profileType = "seeker",
  userRole,
}: ProfileNavProps) {
  const userStoreUser = useUserStore((state) => state.user);
  const seekerTabs = [
    { name: "Om meg", icon: User },
    { name: "Fullførte", icon: Briefcase },
    { name: "Vurderinger", icon: Star },
    { name: "Portfolio", icon: LayoutGrid },
    { name: "Sertifiseringer", icon: Award },
  ];

  const posterTabs = [
    { name: "Aktive", icon: LayoutGrid },
    { name: "Tidligere", icon: Briefcase },
    { name: "Vurderinger", icon: Star },
  ];

  const companyTabs = [
    { name: "Portfolio", icon: LayoutGrid },
    { name: "Sertifiseringer", icon: Award },
    { name: "Aktive", icon: Briefcase },
    { name: "Tidligere", icon: Clock },
    { name: "Vurderinger", icon: Star },
  ];

  const tabs =
    profileType === "seeker"
      ? seekerTabs
      : userRole === "company" || userStoreUser?.role === "company"
        ? companyTabs
        : posterTabs;

  return (
    <div className="flex border-b border-black/5 mb-5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.name;
        return (
          <button
            key={tab.name}
            onClick={() => onTabChange(tab.name)}
            className={`flex items-center gap-1.5 py-3 px-4.5 text-[13px] border-b-2 transition-all whitespace-nowrap ${
              isActive
                ? "border-custom-green text-custom-green font-medium"
                : "border-transparent text-black/40 hover:text-black/60"
            }`}
          >
            <Icon
              size={14}
              className={isActive ? "text-custom-green" : "text-black/40"}
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span>{tab.name}</span>
          </button>
        );
      })}
    </div>
  );
}
