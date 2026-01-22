import React, { useState, useEffect } from "react";
import {
  Trash2 as TrashIcon,
  Upload as UploadIcon,
  CheckCircle2 as ActiveIcon,
  X as CloseIcon,
  AlertCircle as ExpiredIcon,
  Clock as SoonIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Pencil as EditIcon,
} from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";

const CarouselPage: React.FC = () => {
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null); // To track edit mode

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

  // Function to open modal for editing
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

  // Helper to reset and close modal
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
        // Edit Logic
        await mainLink.put(`/api/admin/hero/${editingId}`, formData);
        Swal.fire("Suksess!", "Hero banner er oppdatert", "success");
      } else {
        // Create Logic
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
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-50">
                <th className="pb-6 px-4">Preview</th>
                <th className="pb-6 px-4">Title / Info</th>
                <th className="pb-6 px-4 text-center">Status</th>
                <th className="pb-6 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50/50">
              {heroes.map((item: any) => {
                const status = getStatus(item.activeFrom, item.expireAt);
                return (
                  <tr
                    key={item._id}
                    className="group hover:bg-gray-50/30 transition-all"
                  >
                    <td className="py-5 px-4">
                      <div className="w-32 h-20 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                        <img
                          src={item.image}
                          alt="Hero"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    </td>
                    <td className="py-5 px-4">
                      <p className="text-gray-800 font-bold">{item.title}</p>
                      <p
                        className={`text-[11px] font-bold mt-1 ${status.dateTextColor}`}
                      >
                        {status.dateInfo}
                      </p>
                    </td>
                    <td className="py-5 px-4 text-center">
                      <span
                        className={`${status.color} text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-sm`}
                      >
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td className="py-5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="bg-blue-50 text-blue-500 p-2.5 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-sm active:scale-90"
                        >
                          <EditIcon size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(item._id)}
                          className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-90"
                        >
                          <TrashIcon size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {heroes.length === 0 && !loading && (
            <p className="text-center py-10 text-gray-400">No data found</p>
          )}
        </div>

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeModal}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
            >
              <CloseIcon />
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              {editingId ? "Update Hero Banner" : "Add New Hero Banner"}
            </h2>

            <form
              onSubmit={handleSubmit}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">
                  Title
                </label>
                <input
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
                  placeholder="E.g. Summer Sale"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">
                  Subtitle
                </label>
                <input
                  value={formData.subtitle}
                  onChange={(e) =>
                    setFormData({ ...formData, subtitle: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">
                  Image URL
                </label>
                <input
                  required
                  value={formData.image}
                  onChange={(e) =>
                    setFormData({ ...formData, image: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">
                  Active From
                </label>
                <input
                  type="date"
                  required
                  value={formData.activeFrom}
                  onChange={(e) =>
                    setFormData({ ...formData, activeFrom: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 outline-none focus:border-[#2d4a3e]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">
                  Expire At
                </label>
                <input
                  type="date"
                  required
                  value={formData.expireAt}
                  onChange={(e) =>
                    setFormData({ ...formData, expireAt: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 outline-none focus:border-[#2d4a3e]"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-100 bg-gray-50 focus:bg-white focus:border-[#2d4a3e] outline-none transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                className="col-span-2 mt-2 bg-[#2d4a3e] text-white py-4 rounded-2xl font-bold hover:bg-[#233b31] transition-all shadow-lg active:scale-95"
              >
                {editingId ? "Update Hero Banner" : "Create Hero Banner"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarouselPage;
