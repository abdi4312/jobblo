import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  Users,
  Calendar,
  User,
  Clock,
  Filter,
} from "lucide-react";
import { useMyApplicantsOverviewQuery } from "../../features/applicants/hooks";

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString("no-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

type StatusFilter =
  | "all"
  | "open"
  | "in_progress"
  | "completed"
  | "awaiting_payment"
  | "waiting_for_approval";
type ApplicantFilter = "all" | "has_applicants" | "no_applicants";
type SortOption = "newest" | "oldest" | "price_high" | "price_low";

const MyApplicantsOverview: React.FC = () => {
  const navigate = useNavigate();
  const { data: services, isLoading, error } = useMyApplicantsOverviewQuery();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [applicantFilter, setApplicantFilter] =
    useState<ApplicantFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

  const filteredAndSortedServices = useMemo(() => {
    if (!services) return [];

    let filtered = [...services];

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((service) => service.status === statusFilter);
    }

    // Apply applicant filter
    if (applicantFilter === "has_applicants") {
      filtered = filtered.filter((service) => service.applicantCount > 0);
    } else if (applicantFilter === "no_applicants") {
      filtered = filtered.filter((service) => service.applicantCount === 0);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortOption) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        case "price_high":
          return b.price - a.price;
        case "price_low":
          return a.price - b.price;
        default:
          return 0;
      }
    });

    return filtered;
  }, [services, statusFilter, applicantFilter, sortOption]);

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

        {/* Filters & Sort */}
        <div className="bg-white rounded-2xl p-4 mb-6 border border-black/5">
          <div className="flex items-center gap-2 mb-4">
            <Filter size={18} className="text-gray-600" />
            <span className="font-medium text-gray-800">
              Filter og sortering
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-custom-green"
              >
                <option value="all">Alle</option>
                <option value="open">Aktiv</option>
                <option value="in_progress">I gang</option>
                <option value="completed">Fullført</option>
                <option value="awaiting_payment">Venter på betaling</option>
                <option value="waiting_for_approval">
                  Venter på godkjenning
                </option>
              </select>
            </div>

            {/* Applicant Filter */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Søkere
              </label>
              <select
                value={applicantFilter}
                onChange={(e) =>
                  setApplicantFilter(e.target.value as ApplicantFilter)
                }
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-custom-green"
              >
                <option value="all">Alle</option>
                <option value="has_applicants">Har søkere</option>
                <option value="no_applicants">Ingen søkere</option>
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">
                Sortering
              </label>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-custom-green"
              >
                <option value="newest">Nyeste først</option>
                <option value="oldest">Eldste først</option>
                <option value="price_high">Høyeste pris</option>
                <option value="price_low">Laveste pris</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {filteredAndSortedServices.map((service: any) => (
            <div
              key={service._id}
              onClick={() => navigate(`/job-applicants/${service._id}`)}
              className="bg-white rounded-[20px] p-4 md:p-6 cursor-pointer hover:shadow-md transition-shadow border border-black/5"
            >
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        service.status === "in_progress"
                          ? "bg-blue-100 text-blue-600"
                          : service.status === "open"
                            ? "bg-green-100 text-green-600"
                            : service.status === "awaiting_payment"
                              ? "bg-yellow-100 text-yellow-700"
                              : service.status === "waiting_for_approval"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {service.status === "in_progress"
                        ? "I GANG"
                        : service.status === "open"
                          ? "AKTIV"
                          : service.status === "completed"
                            ? "FULLFØRT"
                            : service.status === "awaiting_payment"
                              ? "VENTER PÅ BETALING"
                              : service.status === "waiting_for_approval"
                                ? "VENTER PÅ GODKJENNING"
                                : "AVSLUTTET"}
                    </span>
                    <span className="text-[11px] text-gray-400 font-medium">
                      {service.location?.city || "Oslo"}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 line-clamp-1">
                    {service.title}
                  </h3>

                  {/* Additional Info Row */}
                  <div className="flex flex-wrap gap-4 text-[12px] text-gray-500">
                    {/* Date Created */}
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>Opprettet: {formatDate(service.createdAt)}</span>
                    </div>
                    {/* Last Activity */}
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      <span>
                        Siste aktivitet: {formatDate(service.lastActivity)}
                      </span>
                    </div>
                    {/* Categories */}
                    {service.categories && service.categories.length > 0 && (
                      <div className="flex items-center gap-1">
                        <span>Kategori: {service.categories.join(", ")}</span>
                      </div>
                    )}
                    {/* Deadline */}
                    {service.toDate && (
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>Frist: {formatDate(service.toDate)}</span>
                      </div>
                    )}
                    {/* Selected Worker */}
                    {service.selectedWorker && (
                      <div className="flex items-center gap-1">
                        <User size={14} />
                        <span>Valgt: {service.selectedWorker.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-8 md:gap-16 ml-4">
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
            </div>
          ))}

          {filteredAndSortedServices.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-medium">
                Ingen oppdrag som matcher filterene.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyApplicantsOverview;
