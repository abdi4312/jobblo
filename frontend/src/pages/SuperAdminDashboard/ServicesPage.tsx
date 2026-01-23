import React, { useState, useEffect } from "react";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";
import ServiceCard from "../../components/SuperAdminDashboard/Service/ServiceCard";

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
          {services.length === 0 && (
            <p className="text-center py-10 text-gray-400">
              No services found.
            </p>
          )}
        </>
      )}

      {/* Pagination Window Logic - NO CHANGES MADE */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-12 gap-2">
          <button
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="p-2 disabled:opacity-20 hover:bg-gray-50 rounded-full transition-all"
          >
            <ChevronLeft />
          </button>

          {(() => {
            const maxVisible = 8;
            let startPage = Math.max(
              1,
              currentPage - Math.floor(maxVisible / 2),
            );
            let endPage = startPage + maxVisible - 1;

            if (endPage > totalPages) {
              endPage = totalPages;
              startPage = Math.max(1, endPage - maxVisible + 1);
            }

            return Array.from(
              { length: endPage - startPage + 1 },
              (_, i) => startPage + i,
            ).map((num) => (
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
            ));
          })()}

          <button
            disabled={currentPage === totalPages || loading}
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

export default ServicesPage;
