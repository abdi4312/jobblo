import React from "react";
import { Button } from "./button/Button";

interface SwitcherOption {
  id: string;
  label: string;
}

interface CustomSwitcherProps {
  options: SwitcherOption[];
  value: string;
  onChange: (value: string) => void;
  maxWidth?: string;
  className?: string;
}

/**
 * Reusable Switcher component
 */
export const CustomSwitcher: React.FC<CustomSwitcherProps> = ({
  options,
  value,
  onChange,
  maxWidth = "max-w-100",
  className = "",
}) => {
  return (
    <div className={`flex justify-center py-4 ${className}`}>
      <div className={`flex box-card-custom w-full ${maxWidth} mx-4`}>
        {options.map((option) => (
          <Button
            key={option.id}
            label={option.label}
            variant={value === option.id ? "true" : "false"}
            size="lg"
            onClick={() => onChange(option.id)}
          />
        ))}
      </div>
    </div>
  );
};
