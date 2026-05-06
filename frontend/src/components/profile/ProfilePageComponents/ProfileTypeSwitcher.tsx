import React from "react";
import { Button } from "../../Ui/button/Button";

interface ProfileTypeSwitcherProps {
  profileType: "seeker" | "poster";
  onTypeChange: (type: "seeker" | "poster") => void;
}

export const ProfileTypeSwitcher: React.FC<ProfileTypeSwitcherProps> = ({
  profileType,
  onTypeChange,
}) => {
  const tabs = [
    { id: "seeker", label: "Jobbsøker" },
    { id: "poster", label: "Oppdragsgiver" },
  ] as const;

  return (
    <div className="flex justify-center py-4">
      <div className="flex box-card-custom w-full max-w-100 mx-4">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            label={tab.label}
            variant={profileType === tab.id ? "true" : "false"}
            size="lg"
            onClick={() => onTypeChange(tab.id)}
          />
        ))}
      </div>
    </div>
  );
};
