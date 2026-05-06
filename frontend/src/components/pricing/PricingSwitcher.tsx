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
  return (
    <div className="flex justify-center mb-12">
      <div className="inline-flex box-card-custom w-full max-w-100 ">
        <Button
          label="Business"
          variant={userType === "business" ? "true" : "false"}
          size="lg"
          onClick={() => setUserType("business")}
        />
        <Button
          label="Individual"
          variant={userType === "private" ? "true" : "false"}
          size="lg"
          onClick={() => setUserType("private")}
        />
      </div>
    </div>
  );
};
