import React from "react";
import { Button } from "../Ui/button/Button";
interface ContractsFilterProps {
  activeFilter: "Alle" | "Sendte" | "Mottatte";
  setActiveFilter: (filter: "Alle" | "Sendte" | "Mottatte") => void;
}

export const ContractsFilter: React.FC<ContractsFilterProps> = ({
  activeFilter,
  setActiveFilter,
}) => {
  const filters = ["Alle", "Sendte", "Mottatte"] as const;
  return (
    <div className="flex box-card-custom mb-8 w-full max-w-100">
      {filters.map((filter) => (
        <Button
          key={filter}
          onClick={() => setActiveFilter(filter)}
          variant={activeFilter === filter ? "true" : "false"}
          size="lg"
        >
          {filter}
        </Button>
      ))}
    </div>
  );
};
