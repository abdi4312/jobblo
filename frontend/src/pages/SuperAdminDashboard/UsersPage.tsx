import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2"; // Confirmation alerts ke liye

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);

  // --- API: Fetch Users ---
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(
        `/api/admin/users?page=${currentPage}&limit=${limit}`,
      );
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- API: Change Role ---
  const handleRoleChange = async (id: string, newRole: string) => {
    const result = await Swal.fire({
      title: "Update User Role?",
      text: `Do you want to change this user's role to ${newRole.toUpperCase()}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2d4a3e",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, Update it!",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        // Backend API call (Aapke endpoint ke mutabiq)
        await mainLink.put(`/api/admin/users/${id}/role`, { role: newRole });

        // UI update bina refresh ke
        setUsers((prevUsers: any) =>
          prevUsers.map((u: any) =>
            u._id === id ? { ...u, role: newRole } : u,
          ),
        );

        Swal.fire({
          title: "Updated!",
          text: "Role has been updated successfully.",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      } catch (err) {
        Swal.fire("Error", "Failed to update role", "error");
        fetchUsers(); // Error pe purana data wapis layein
      }
    } else {
      // Agar cancel kare toh UI refresh karein taaki dropdown purani value dikhaye
      fetchUsers();
    }
  };

  // --- API: Delete User ---
  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "This user will be permanently deleted!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#2d4a3e",
      confirmButtonText: "Yes, delete!",
    });

    if (result.isConfirmed) {
      try {
        await mainLink.delete(`/api/admin/users/${id}`);
        fetchUsers(); // List refresh karein
        Swal.fire("Deleted!", "User deleted successfully.", "success");
      } catch (err) {
        Swal.fire("Error", "Failed to delete user", "error");
      }
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentPage, limit]);

  return (
    <div className="animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Users Stats</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard
          icon={<Users className="text-orange-500" />}
          label="Total Users"
          value="46,910"
          trend="8.5%"
        />
        <StatCard
          icon={<UserPlus className="text-blue-500" />}
          label="New Users"
          value="40"
          trend="8.5%"
        />
        <StatCard
          icon={<Calendar className="text-green-600" />}
          label="Monthly"
          value="901"
          trend="8.5%"
        />
      </div>

      <div className="bg-white rounded-4xl p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
          </select>
        </div>

        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-225">
            <thead>
              <tr className="text-gray-400 text-xs font-bold uppercase tracking-widest border-b border-gray-50">
                <th className="pb-5 px-4">Name</th>
                <th className="pb-5 px-4">Phone</th>
                <th className="pb-5 px-4 text-center">Points</th>
                <th className="pb-5 px-4 text-center">Role</th>
                <th className="pb-5 px-4 text-center">Joined</th>
                <th className="pb-5 px-4 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-gray-400">
                    Fetching Data...
                  </td>
                </tr>
              ) : (
                users.map((user: any) => (
                  <tr
                    key={user._id}
                    className="group hover:bg-gray-50/80 transition-colors"
                  >
                    <td className="py-5 px-4 text-gray-800 font-bold">
                      {user.name}
                    </td>
                    <td className="py-5 px-4 text-gray-500 font-medium max-w-30 overflow-hidden text-ellipsis whitespace-nowrap">
                      {user.phone}
                    </td>
                    <td className="py-5 px-4 text-center font-bold text-gray-800">
                      {user.pointsBalance || 0}
                    </td>

                    {/* Role Dropdown */}
                    <td className="py-5 px-4 text-center">
                      <select
                        value={user.role}
                        onChange={(e) =>
                          handleRoleChange(user._id, e.target.value)
                        }
                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg border-none cursor-pointer shadow-sm
                          ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        <option value="user">User</option>
                        <option value="provider">Provider</option>
                      </select>
                    </td>

                    <td className="py-5 px-4 text-center text-gray-400 text-xs font-medium">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>

                    <td className="py-5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="bg-red-50 text-red-500 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- Pagination --- */}
        <div className="flex justify-center items-center mt-10 gap-2">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="p-2 hover:bg-gray-100 disabled:opacity-20"
          >
            <ChevronLeft size={20} />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              onClick={() => setCurrentPage(num)}
              className={`w-10 h-10 rounded-full font-bold transition-all ${currentPage === num ? "bg-white border shadow-sm scale-110" : "text-gray-400"}`}
            >
              {num}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => prev + 1)}
            className="p-2 hover:bg-gray-100 disabled:opacity-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// StatCard helper component
const StatCard = ({ icon, label, value, trend }: any) => (
  <div className="bg-white p-6 rounded-[2.5rem] flex justify-between items-center shadow-sm border border-gray-50">
    <div className="flex items-center gap-4">
      <div className="p-4 bg-gray-50 rounded-[1.25rem]">{icon}</div>
      <div>
        <p className="text-2xl font-black text-gray-800 leading-none mb-1">
          {value}
        </p>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">
          {label}
        </p>
      </div>
    </div>
    <div className="text-green-500 font-black text-sm self-start mt-1">
      ↗ {trend}
    </div>
  </div>
);

export default UsersPage;
