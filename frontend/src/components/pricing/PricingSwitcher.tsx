import React from "react";
import { Button } from "../../components/Ui/button/Button";

interface PricingSwitcherProps {
  userType: "business" | "private";
  setUserType: (type: "business" | "private") => void;
}

export const PricingSwitcher: React.FC<PricingSwitcherProps> = ({
  userType,
  setUserType,
}) => {
  const tabs = [
    { id: "business", label: "Business" },
    { id: "private", label: "Individual" },
  ] as const;
  return (
    <div className="flex justify-center mb-12">
      <div className="inline-flex box-card-custom w-full max-w-100">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            label={tab.label}
            variant={userType === tab.id ? "true" : "false"}
            size="lg"
            onClick={() => setUserType(tab.id)}
          />
        ))}
      </div>
    </div>
  );
};
