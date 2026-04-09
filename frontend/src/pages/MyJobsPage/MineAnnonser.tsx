import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import { Clock4, MapPin, Pencil } from "lucide-react";
import { Button } from "../../components/Ui/Button";
import { useMyServices } from "../../features/services/hooks";
import { useServiceActions } from "../../features/services/hooks";
import type { Service } from "../../features/services/types";
import { JobDetailCardSkeleton } from "../../components/Loading/JobDetailCardSkeleton";

export default function MineAnnonser() {
  const navigate = useNavigate();
  const [editingService, setEditingService] = useState<Service | null>(null);

  // TanStack Hooks
  const { data: services = [], isLoading, error } = useMyServices();
  const { deleteMutation, updateMutation } = useServiceActions();

  const categoryColorMap: Record<string, string> = {
    Rørlegger: "#EF7909",
    Renhold: "#2F7E47",
    Maling: "#238CEB",
    Hagearbeid: "#EF7909",
    Flytting: "#2F7E47",
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
  };

  const handleDelete = (serviceId: string) => {
    if (confirm("Er du sikker på at du vil slette denne annonsen?")) {
      deleteMutation.mutate(serviceId);
    }
  };

  const handleFormSubmit = (jobData: FormData) => {
    if (editingService) {
      updateMutation.mutate(
        { id: editingService._id, data: jobData as unknown as Service },
        { onSuccess: () => setEditingService(null) },
      );
    }
  };

  if (isLoading) return <JobDetailCardSkeleton />;
  if (error) return <div>Feil ved henting av annonser</div>;

  if (editingService) {
    return (
      <>
        {/* Form Container */}
        <div className="p-2 max-w-300 mx-auto">
          <CreateJobForm
            onSubmit={handleFormSubmit}
            userId=""
            isEditMode={true}
            initialData={{
              title: editingService.title,
              description: editingService.description,
              price: editingService.price.toString(),
              address: editingService.location.address,
              city: editingService.location.city,
              categories: editingService.categories.join(", "),
              urgent: editingService.urgent,
              equipment: editingService.equipment || "",
              fromDate: editingService.fromDate
                ? new Date(editingService.fromDate).toISOString().split("T")[0]
                : "",
              toDate: editingService.toDate
                ? new Date(editingService.toDate).toISOString().split("T")[0]
                : "",
              durationValue: editingService.duration?.value?.toString() || "",
              durationUnit: editingService.duration?.unit || "hours",
              images: editingService.images || [],
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div className="p-0 max-w-300 mx-auto min-h-screen">
      {services.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="bg-gray-100 p-6 rounded-full mb-4">
            <Pencil size={40} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            Du har ingen annonser
          </h3>
          <p className="text-gray-500 mb-6">
            Det ser ut som du ikke har lagt ut noen tjenester ennå.
          </p>
          <Button
            label="Lag din første annonse"
            onClick={() => navigate("/publish-job")}
            className="bg-[#EF7909] text-white px-6 py-2 rounded-xl"
          />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 m-2 gap-2.5">
          {services.map((job: Service) => {
            const catName = Array.isArray(job.categories)
              ? job.categories[0]
              : job.categories;
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
                    <span className="text-[#666] text-base">
                      No image available
                    </span>
                  )}

                  <div
                    className="absolute top-4 right-2 bg-[#EF7909] px-3 py-1.5 text-white rounded-[20px] flex items-center justify-center"
                    style={{ backgroundColor: badgeColor }}
                  >
                    <span className="text-[12px]">
                      {catName || "Rørlegger"}
                    </span>
                  </div>

                  <div className="absolute flex justify-between items-center text-[#0A0A0A] bottom-4 left-4.5 right-4.5">
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(job);
                      }}
                    >
                      <Pencil size={20} className="text-[#EF7909]" />
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
                    <Button
                      label="Delete"
                      className="bg-red-500! rounded-xl"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(job._id);
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
