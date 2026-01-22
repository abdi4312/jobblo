import React, { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";

const ServicesPage: React.FC = () => {
  const [services, setServices] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(6);
  const [loading, setLoading] = useState(true);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(
        `/api/admin/services?page=${currentPage}&limit=${limit}`,
      );
      setServices(response.data.services || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching services:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Delete Service?",
      text: "Are you sure you want to remove this service?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#2d4a3e",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await mainLink.delete(`/api/admin/services/${id}`);
        Swal.fire("Deleted!", "Service has been removed.", "success");
        fetchServices();
      } catch (err) {
        Swal.fire("Error", "Failed to delete service", "error");
      }
    }
  };

  useEffect(() => {
    fetchServices();
  }, [currentPage, limit]);

  return (
    <div className="animate-in fade-in duration-500 p-4">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
          Services
        </h1>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none shadow-sm cursor-pointer"
          >
            <option value={6}>6 Per Page</option>
            <option value={12}>12 Per Page</option>
          </select>
          <button className="flex-1 sm:flex-none bg-[#2d4a3e] text-white px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 hover:bg-[#233b31] transition-all font-bold text-sm shadow-md active:scale-95">
            <Plus size={18} /> Add New
          </button>
        </div>
      </div>

      {/* Services Grid */}
      {loading ? (
        <div className="flex justify-center py-20 text-gray-400 font-bold">
          Loading Services...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {services.map((service: any) => (
              <ServiceCard
                key={service._id}
                data={service}
                onDelete={() => handleDelete(service._id)}
              />
            ))}
          </div>
          {services.length === 0 && <p className="text-center py-10 text-gray-400">No services found.</p>}
        </>
      )}

      {/* Pagination Numbers Logic */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-12 gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="p-2 disabled:opacity-20 hover:bg-gray-50 rounded-full transition-all"
          >
            <ChevronLeft />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-10 h-10 text-center flex items-center justify-center rounded-full font-bold transition-all ${
                currentPage === num 
                ? "bg-[#2d4a3e] text-white shadow-md scale-110" 
                : "text-gray-400 hover:bg-gray-100"
              }`}
            >
              {num}
            </button>
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="p-2 disabled:opacity-20 hover:bg-gray-50 rounded-full transition-all"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
};

// --- Service Card Sub-component ---
const ServiceCard = ({ data, onDelete }: { data: any; onDelete: () => void }) => {
  const locationLabel = typeof data.location === "object" 
    ? data.location.address || data.location.city || "Oslo" 
    : data.location || "N/A";

  const displayPrice = typeof data.price === "object"
    ? `${data.price.value || 0}${data.price.unit || "kr"}`
    : `${data.price || 0} kr`;

  const displayDuration = typeof data.duration === "object"
    ? `${data.duration.value || "N/A"} ${data.duration.unit || ""}`
    : data.duration || "Fixed";

  const serviceImage = data.images && data.images.length > 0
    ? data.images[0]
    : data.image || "https://via.placeholder.com/500";

  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 group flex flex-col h-full">
      <div className="relative h-52 overflow-hidden m-4 rounded-[2rem]">
        <img
          src={serviceImage}
          alt={data.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 bg-white/90 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg z-10"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="p-6 pt-0 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-gray-800 line-clamp-1">{data.title || "Tjeneste"}</h3>
          <span className="bg-[#f6ad55] text-white text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
            {displayPrice}
          </span>
        </div>
        <p className="text-gray-400 text-xs mb-6 line-clamp-2 font-medium">
          {data.description || "Ingen beskrivelse tilgjengelig"}
        </p>
        <div className="flex items-center gap-3 mb-6 mt-auto">
          <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <MapPin size={12} className="text-gray-400 shrink-0" />
            <span className="text-[10px] font-bold text-gray-500 truncate max-w-[80px]">{locationLabel}</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <Clock size={12} className="text-gray-400 shrink-0" />
            <span className="text-[10px] font-bold text-gray-500">{displayDuration}</span>
          </div>
        </div>
        <button className="w-full bg-[#3e5a4d] text-white py-3 font-extrabold text-[12px] flex justify-center items-center !rounded-4xl hover:bg-[#2d4a3e] shadow-lg transition-all active:scale-95">
          Update Now
        </button>
      </div>
    </div>
  );
};

export default ServicesPage;