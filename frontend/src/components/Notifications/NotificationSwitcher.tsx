import React from "react";
import { Button } from "../../components/Ui/button/Button";

interface Tab {
  id: string;
  label: string;
}

interface NotificationSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

export const NotificationSwitcher: React.FC<NotificationSwitcherProps> = ({
  tabs,
  activeTab,
  onTabChange,
}) => {
  return (
    <div className="flex box-card-custom w-full max-w-100 my-8">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            label={tab.label}
            size="lg"
            variant={isActive ? "true" : "false"}
            onClick={() => onTabChange(tab.id)}
          />
        );
      })}
    </div>
  );
};
