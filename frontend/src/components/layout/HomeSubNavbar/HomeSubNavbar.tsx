import type { Tab } from "../../../types/tabs";

interface HomeSubNavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function HomeSubNavbar({ activeTab, setActiveTab }: HomeSubNavbarProps) {
  const tabs: Tab[] = ["Discover", "People’s", "Favorites"];

  return (
    <div className="w-full bg-white/60 shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white cursor-pointer mb-6 -mt-6">
      <div className="max-w-300 mx-auto px-4">
        <div className="flex justify-around items-center">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative py-4 text-[13px] sm:text-[16px] md:text-[18px] font-bold w-full tracking-tight transition-all duration-200 ${
                activeTab === tab
                  ? "text-black"
                  : "text-gray-400 hover:text-gray-500"
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-[-1.5px] left-0 w-full h-0.5 bg-black rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
