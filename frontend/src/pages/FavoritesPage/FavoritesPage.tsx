import { useNavigate } from "react-router-dom";
import { Clock4, Heart, MapPin } from "lucide-react";
import { Button } from "../../components/Ui/Button.tsx";
import { useFavorites, useFavoriteActions } from "../../features/favorites/hook/useFavorites.ts";
import { JobDetailCardSkeleton } from "../../components/Loading/JobDetailCardSkeleton.tsx";

export function FavoritesPage() {
  const { data, isLoading, isError } = useFavorites();
  const { removeFavorite } = useFavoriteActions();
  const navigate = useNavigate();

  const categoryColorMap: Record<string, string> = {
    "Rørlegger": "#EF7909",
    "Renhold": "#2F7E47",
    "Maling": "#238CEB",
    "Hagearbeid": "#EF7909",
    "Flytting": "#2F7E47",
  };

  const handleRemove = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFavorite(serviceId);
  };

  if (isLoading) return <JobDetailCardSkeleton />;
  if (isError) return <p>Kunne ikke laste favoritter.</p>;
  return (
    <div className="p-0 max-w-300 mx-auto min-h-screen">
      {/* <ProfileTitleWrapper title={"Mine favoritter"} buttonText={"Tilbake"} /> */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 m-2 gap-2.5">
        {data.data.map((favorite: any) => {
          const job = favorite.service;
          const catName = Array.isArray(job.categories) ? job.categories[0] : job.categories;
          const badgeColor = categoryColorMap[catName as string] || "#EF7909";
          const handleCardClick = () => {
            navigate(`/job-listing/${job._id}`);
          };

          return (
            <div
              key={job._id}
              onClick={handleCardClick}
              className={`mx-auto bg-[#FFFFFF1A] w-full rounded-xl shadow-md cursor-pointer overflow-hidden`}
            >
              {/* Image Section */}
              <div className="relative w-full h-45 bg-[#f0f0f0] flex items-center justify-center">
                {job.images[0] ? (
                  <img
                    src={job.images[0]}
                    alt={job.title}
                    className="w-full h-full p-2 object-cover rounded-t-2xl"
                  />
                ) : (
                  <span className="text-[#666] text-base">No image available</span>
                )}

                <div
                  className="absolute top-4 right-2 bg-[#EF7909] px-3 py-1.5 text-white rounded-[20px] flex items-center justify-center"
                  style={{ backgroundColor: badgeColor }}
                >
                  <span className="text-[12px]">
                    {catName || "Rørlegger"}
                  </span>
                </div>

                <div
                  className="absolute flex justify-between items-center text-[#0A0A0A] bottom-4 left-4.5 right-4.5"
                >
                  {/* Left Side: Location Badge */}
                  <div className="bg-[#D9D9D9]/80 px-3 py-1.5 rounded-[20px] flex items-center justify-center gap-1.5 backdrop-blur-sm">
                    <MapPin size={13} />
                    <span className="text-[12px] font-normal">
                      {job.location.city}
                    </span>
                  </div>

                  {/* Right Side: Heart Icon */}
                  <div
                    className="px-2 py-1.5 bg-[#D9D9D9]/80 backdrop-blur-sm rounded-2xl cursor-pointer"
                    onClick={(e) => handleRemove(job._id, e)}
                  >
                    <Heart size={20} className="text-red-500 fill-red-500" />
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="gap-3 p-4">
                <h2 className="text-[#0A0A0A] whitespace-nowrap overflow-hidden text-ellipsis font-bold text-[20px]">
                  {job.title}
                </h2>

                <p className="text-[#0A0A0A] text-base font-light">
                  {job.description}
                </p>
              </div>

              {/* Job Details */}
              <div className="flex justify-between p-4">

                <div className="flex items-center gap-1">
                  {/* <span className="material-symbols-outlined text-[12.5px] text-[#4A5565]">Schedule</span> */}
                  <Clock4 size={13} />
                  <h3 className="m-0 whitespace-nowrap overflow-hidden text-ellipsis text-[12px] font-normal">
                    {job.duration.value
                      ? `${job.duration.value} ${job.duration.unit}`
                      : "Ikke angitt"}
                  </h3>
                </div>

                <div className="flex items-center gap-6">
                  <p className="text-[24px] font-bold">{job.price}Kr</p>
                  <Button label="Søk nå" className="bg-[#2F7E47]! rounded-xl" />
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
