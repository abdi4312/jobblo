import {
  LayoutGrid,
  Bookmark,
  Briefcase,
  Star,
  Clock,
  User,
  Award,
} from "lucide-react";

interface ProfileNavProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
  isOwnProfile?: boolean;
  profileType?: "seeker" | "poster";
}

export function ProfileNav({
  activeTab,
  onTabChange,
  isOwnProfile = false,
  profileType = "seeker",
}: ProfileNavProps) {
  const seekerTabs = [
    { name: "Om meg", icon: User },
    { name: "Fullførte", icon: Briefcase },
    { name: "Vurderinger", icon: Star },
    { name: "Portfolio", icon: LayoutGrid },
  ];

  const posterTabs = [
    { name: "Aktive", icon: LayoutGrid },
    { name: "Tidligere", icon: Briefcase },
    { name: "Vurderinger", icon: Star },
  ];

  const tabs = profileType === "seeker" ? seekerTabs : posterTabs;

  return (
    <div className="border-b border-gray-200 bg-white">
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
