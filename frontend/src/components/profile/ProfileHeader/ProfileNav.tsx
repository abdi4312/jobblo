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
    <div className="box-card-custom rounded-none">
      <div className="max-w-300 mx-auto px-4 sm:px-6">
        <div className="flex justify-around md:justify-around md:gap-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.name;
            return (
              <button
                key={tab.name}
                onClick={() => onTabChange(tab.name)}
                className={`flex items-center gap-3 py-4.5 px-1 border-b-[3px] w-full justify-center text-lg font-bold mb-[-1.5px] whitespace-nowrap ${
                  isActive
                    ? "border-black text-black"
                    : "border-transparent text-gray-400 hover:text-gray-900"
                }`}
              >
                <Icon
                  size={22}
                  className={isActive ? "text-black" : "text-gray-400"}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="hidden md:flex">{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
