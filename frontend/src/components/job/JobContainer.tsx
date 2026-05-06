import { Award, Calendar, Clock4, MapPin } from "lucide-react";
import React from "react";

interface JobContainerProps {
  job: {
    title: string;
    createdAt: string;
    location?: { city: string };
    duration?: { value: number; unit: string };
    categories?: string[];
    equipment?: string;
  };
}

const JobContainer: React.FC<JobContainerProps> = ({ job }) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return "Ikke oppgitt";
    const date = new Date(dateString);
    return date.toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const renderBox = (icon: React.ReactNode, label: string, value: string) => (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-white shadow-[0px_2px_4px_0px_rgba(0,0,0,0.08)] px-4 py-4">
      <p className="flex gap-1.5 items-center text-[13px] font-normal text-[#0A0A0A9E]">
        <span>{icon}</span> {label}
      </p>
      <p className="text-custom-black text-[15px] font-semibold text-end">
        {value}
      </p>
    </div>
  );

  return (
    <div className="pt-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {renderBox(
          <Calendar size={14} />,
          "Publisert",
          formatDate(job?.createdAt),
        )}
        {renderBox(
          <Clock4 size={14} />,
          "Varighet",
          `${job?.duration?.value || ""} ${job?.duration?.unit || ""}`,
        )}
        {renderBox(
          <MapPin size={14} />,
          "Lokasjon",
          job?.location?.city || "Ikke oppgitt",
        )}
        {renderBox(
          <Award size={14} />,
          "Erfaring",
          job?.equipment || "Ikke oppgitt",
        )}
      </div>
    </div>
  );
};

export default JobContainer;
