import React, { useState, useEffect } from "react";
import {
  Upload as UploadIcon,
  CheckCircle2 as ActiveIcon,
  AlertCircle as ExpiredIcon,
  Clock as SoonIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
} from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";
import HeroTable from "../../components/SuperAdminDashboard/Carousel/HeroTable";
import HeroModal from "../../components/SuperAdminDashboard/Carousel/HeroModal";

const CarouselPage: React.FC = () => {
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    description: "",
    image: "",
    activeFrom: "",
    expireAt: "",
  });

  const fetchHeroes = async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(
        `/api/admin/hero?page=${currentPage}&limit=5`,
      );
      setHeroes(response.data.heroes || []);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeroes();
  }, [currentPage]);

  const handleEdit = (item: any) => {
    setEditingId(item._id);
    setFormData({
      title: item.title || "",
      subtitle: item.subtitle || "",
      description: item.description || "",
      image: item.image || "",
      activeFrom: item.activeFrom
        ? new Date(item.activeFrom).toISOString().split("T")[0]
        : "",
      expireAt: item.expireAt
        ? new Date(item.expireAt).toISOString().split("T")[0]
        : "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      title: "",
      subtitle: "",
      description: "",
      image: "",
      activeFrom: "",
      expireAt: "",
    });
  };

  const getStatus = (start: string, end: string) => {
    if (!start || !end)
      return {
        label: "N/A",
        color: "bg-gray-400",
        icon: <ExpiredIcon size={12} />,
        dateInfo: "No Date",
        dateTextColor: "text-gray-400",
      };
    const now = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);

    if (now < startDate) {
      return {
        label: "Coming Soon",
        color: "bg-orange-400",
        icon: <SoonIcon size={12} />,
        dateInfo: `Starts: ${startDate.toLocaleDateString()}`,
        dateTextColor: "text-orange-500",
      };
    } else if (now > endDate) {
      return {
        label: "Expired",
        color: "bg-red-500",
        icon: <ExpiredIcon size={12} />,
        dateInfo: `Expired on: ${endDate.toLocaleDateString()}`,
        dateTextColor: "text-red-500",
      };
    } else {
      return {
        label: "Active",
        color: "bg-green-500",
        icon: <ActiveIcon size={12} />,
        dateInfo: `Ends: ${endDate.toLocaleDateString()}`,
        dateTextColor: "text-green-600",
      };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await mainLink.put(`/api/admin/hero/${editingId}`, formData);
        Swal.fire("Suksess!", "Hero banner er oppdatert", "success");
      } else {
        await mainLink.post("/api/hero", formData);
        Swal.fire("Suksess!", "Hero banner er opprettet", "success");
      }
      closeModal();
      fetchHeroes();
    } catch (error: any) {
      Swal.fire(
        "Feil",
        editingId ? "Kunne ikke oppdatere hero" : "Kunne ikke opprette hero",
        "error",
      );
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Er du sikker?",
      text: "Du vil ikke kunne angre dette!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#2d4a3e",
      confirmButtonText: "Ja, slett den!",
    });

    if (result.isConfirmed) {
      try {
        await mainLink.delete(`/api/admin/hero/${id}`);
        Swal.fire("Slettet!", "Banneret har blitt slettet.", "success");
        fetchHeroes();
      } catch (error) {
        Swal.fire("Feil", "Kunne ikke slette banneret", "error");
      }
    }
  };

  return (
    <div className="animate-in fade-in duration-500 p-4 text-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
            Carousel Management
          </h1>
          <p className="text-gray-400 text-sm font-medium mt-1">
            Administrer nettsidens hovedbannere
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setShowModal(true);
          }}
          className="bg-[#2d4a3e] text-white px-6 py-2.5 rounded-xl flex items-center gap-2 hover:bg-[#233b31] transition-all font-bold text-sm shadow-md active:scale-95"
        >
          <UploadIcon size={18} /> Upload New Banner
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] p-4 md:p-8 shadow-sm border border-gray-50 overflow-hidden">
        <HeroTable
          heroes={heroes}
          getStatus={getStatus}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          loading={loading}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-12 gap-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="p-2 disabled:opacity-20 hover:bg-gray-50 rounded-full transition-all"
            >
              <PrevIcon size={20} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                className={`w-10 h-10 text-center flex items-center justify-center rounded-full font-bold transition-all ${
                  currentPage === num
                    ? "bg-[#2d4a3e] text-white shadow-md scale-110"
                    : "text-gray-400 hover:bg-gray-50"
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
              <NextIcon size={20} />
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <HeroModal
          editingId={editingId}
          formData={formData}
          setFormData={setFormData}
          handleSubmit={handleSubmit}
          closeModal={closeModal}
        />
      )}
    </div>
  );
};

export default CarouselPage;
