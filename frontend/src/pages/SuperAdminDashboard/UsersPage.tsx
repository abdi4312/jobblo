import React, { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";
import mainLink from "../../api/mainURLs";
import Swal from "sweetalert2";
import UserTable from "../../components/SuperAdminDashboard/User/UserTable";
import CreateUserModal from "../../components/SuperAdminDashboard/User/CreateUserModal";

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [stats, setStats] = useState({ total: 0, new: 0, activeMonth: 0 });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", phone: "", password: "", role: "user" });

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await mainLink.get(`/api/admin/users?page=${currentPage}&limit=${limit}&search=${searchTerm}&role=${roleFilter}`);
      setUsers(response.data.users);
      setTotalPages(response.data.totalPages);
      setStats({
        total: response.data.totalUsers || 0,
        activeMonth: response.data.activeThisMonth || 0,
        new: response.data.users.filter((u: any) => new Date(u.createdAt).toDateString() === new Date().toDateString()).length,
      });
    } catch (error) { console.error(error); } finally { setLoading(false); }
  }, [currentPage, limit, searchTerm, roleFilter]);

  useEffect(() => { fetchUsers(); }, [currentPage, limit]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      currentPage !== 1 ? setCurrentPage(1) : fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await mainLink.post("/api/admin/users", newUser);
      Swal.fire("Success!", "New user has been created.", "success");
      setIsModalOpen(false);
      setNewUser({ name: "", email: "", phone: "", password: "", role: "user" });
      fetchUsers();
    } catch (err: any) { Swal.fire("Error", err.response?.data?.message || "Failed to create user", "error"); }
    finally { setIsSubmitting(false); }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    const result = await Swal.fire({ title: "Update User Role?", text: `Change role to ${newRole.toUpperCase()}?`, icon: "question", showCancelButton: true, confirmButtonColor: "#2d4a3e" });
    if (result.isConfirmed) {
      try {
        await mainLink.put(`/api/admin/users/${id}/role`, { role: newRole });
        setUsers((prev: any) => prev.map((u: any) => (u._id === id ? { ...u, role: newRole } : u)));
        Swal.fire("Updated!", "User role changed.", "success");
      } catch (err) { Swal.fire("Error", "Failed to update role", "error"); }
    }
  };

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({ title: "Are you sure?", text: "Permanent delete!", icon: "warning", showCancelButton: true, confirmButtonColor: "#d33" });
    if (result.isConfirmed) {
      try {
        await mainLink.delete(`/api/admin/users/${id}`);
        fetchUsers();
        Swal.fire("Deleted!", "User removed.", "success");
      } catch (err) { Swal.fire("Error", "Delete failed", "error"); }
    }
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Users Overview</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#2d4a3e] text-white px-5 py-2.5 rounded-2xl flex items-center gap-2 hover:bg-[#1e332a] transition-all shadow-lg active:scale-95">
          <UserPlus size={18} /> <span className="font-bold text-sm">Add New User</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard icon={<Users className="text-orange-500" />} label="Total Users" value={stats.total.toLocaleString()} trend="8.5%" />
        <StatCard icon={<UserPlus className="text-blue-500" />} label="Today's New" value={stats.new} trend="Live" />
        <StatCard icon={<Calendar className="text-green-600" />} label="Active This Month" value={stats.activeMonth} trend="Live" />
      </div>

      <div className="bg-white rounded-4xl p-5 md:p-8 shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row justify-between items-center mb-8 gap-4">
          <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm w-full outline-none focus:border-[#2d4a3e]" />
            </div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm font-semibold outline-none">
              <option value="">All Roles</option>
              <option value="user">User</option><option value="provider">Provider</option><option value="superAdmin">Super Admin</option>
            </select>
          </div>
        </div>

        <UserTable users={users} loading={loading} handleRoleChange={handleRoleChange} handleDelete={handleDelete} />

        {/* Aapka Original Pagination Logic */}
        <div className="flex justify-center items-center mt-10 gap-2">
          <button
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="p-2 hover:bg-gray-100 disabled:opacity-20 rounded-full transition-colors"
          >
            <ChevronLeft size={20} />
          </button>

          {(() => {
            const maxVisible = 8;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let endPage = startPage + maxVisible - 1;
            if (endPage > totalPages) {
              endPage = totalPages;
              startPage = Math.max(1, endPage - maxVisible + 1);
            }
            return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((num) => (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                className={`w-10 h-10 rounded-full flex justify-center items-center font-bold transition-all 
                ${currentPage === num ? "bg-[#2d4a3e] text-white shadow-md scale-110" : "text-gray-400 hover:bg-gray-50"}`}
              >
                {num}
              </button>
            ));
          })()}

          <button
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage((prev) => prev - 1)}
            className="p-2 hover:bg-gray-100 disabled:opacity-20 rounded-full transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <CreateUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} newUser={newUser} setNewUser={setNewUser} handleCreateUser={handleCreateUser} isSubmitting={isSubmitting} />
    </div>
  );
};

// StatCard same original
const StatCard = ({ icon, label, value, trend }: any) => (
  <div className="bg-white p-6 rounded-[2.5rem] flex justify-between items-center shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-center gap-4">
      <div className="p-4 bg-gray-50 rounded-[1.25rem]">{icon}</div>
      <div>
        <p className="text-2xl font-black text-gray-800 leading-none mb-1">{value}</p>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{label}</p>
      </div>
    </div>
    <div className="text-green-500 font-black text-xs self-start mt-1">↗ {trend}</div>
  </div>
);

export default UsersPage;