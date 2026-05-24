import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users } from "lucide-react";
import { useMyApplicantsOverviewQuery } from "../../features/applicants/hooks";

const MyApplicantsOverview: React.FC = () => {
  const navigate = useNavigate();
  const { data: services, isLoading, error } = useMyApplicantsOverviewQuery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f0e8]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-custom-green"></div>
      </div>
    );
  }

  if (error || !services) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#f5f0e8] p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-2">
          Kunne ikke laste oversikt
        </h2>
        <button
          onClick={() => navigate(-1)}
          className="text-custom-green font-medium"
        >
          Gå tilbake
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e8] py-8 px-4 md:px-6">
      <div className="max-w-[1024px] mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Mine søkere</h1>

        <div className="space-y-4">
          {services.map((service: any) => (
            <div
              key={service._id}
              onClick={() => navigate(`/job-applicants/${service._id}`)}
              className="bg-white rounded-[20px] p-4 md:p-6 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow border border-black/5"
            >
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      service.status === "in_progress"
                        ? "bg-blue-100 text-blue-600"
                        : service.status === "open"
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {service.status === "in_progress"
                      ? "I GANG"
                      : service.status === "open"
                        ? "AKTIV"
                        : "AVSLUTTET"}
                  </span>
                  <span className="text-[11px] text-gray-400 font-medium">
                    {service.location?.city || "Oslo"}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
                  {service.title}
                </h3>
              </div>

              <div className="flex items-center gap-8 md:gap-16">
                {/* Applicants Count */}
                <div className="flex flex-col items-end">
                  <div className="flex items-center -space-x-2 mb-1">
                    {service.applicantAvatars.map(
                      (avatar: string, i: number) => (
                        <img
                          key={i}
                          src={avatar}
                          alt=""
                          className="w-7 h-7 rounded-full border-2 border-white object-cover bg-gray-200"
                        />
                      ),
                    )}
                    {service.applicantCount > 0 &&
                      service.applicantAvatars.length === 0 && (
                        <div className="w-7 h-7 rounded-full border-2 border-white bg-custom-green flex items-center justify-center">
                          <Users size={12} className="text-white" />
                        </div>
                      )}
                  </div>
                  <div className="text-right">
                    <span className="text-[15px] font-bold text-gray-900">
                      {service.applicantCount}
                    </span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase ml-1">
                      Søkere
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right hidden sm:block">
                  <div className="text-[15px] font-bold text-gray-900">
                    {service.price.toLocaleString("no-NO")} kr
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase">
                    Pris
                  </div>
                </div>

                {/* Arrow */}
                <div className="text-gray-300">
                  <ChevronRight size={24} />
                </div>
              </div>
            </div>
          ))}

          {services.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">
                Du har ingen aktive oppdrag ennå.
              </p>
              <button
                onClick={() => navigate("/publish-job")}
                className="mt-4 text-custom-green font-bold hover:underline"
              >
                Legg ut et oppdrag
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyApplicantsOverview;
