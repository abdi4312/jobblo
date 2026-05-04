interface SearchTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: { label: string; value: string }[];
}

export const SearchTabs = ({ activeTab, setActiveTab, tabs }: SearchTabsProps) => {
  return (
    <div className="flex bg-[#F5F5F7] p-1.5 rounded-3xl mb-8 w-full max-w-140 mx-auto">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setActiveTab(tab.value)}
          className={`flex-1 py-3 px-4 rounded-[18px] text-[12px] sm:text-[16px] font-semibold transition-all duration-200 ${
            activeTab === tab.value
              ? "bg-white shadow-[0_2px_12px_rgba(0,0,0,0.06)] text-black"
              : "text-gray-500 hover:text-black"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};
