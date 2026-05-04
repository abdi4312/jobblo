import React from "react";

interface Tab {
  id: string;
  label: string;
}

interface NotificationTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const NotificationTabs: React.FC<NotificationTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex bg-gray-100 p-1 rounded-2xl w-full max-w-100 my-8">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              isActive
                ? "bg-white text-black shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
