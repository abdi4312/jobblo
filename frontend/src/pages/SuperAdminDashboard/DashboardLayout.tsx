import React, { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Users,
  LayoutDashboard,
  Briefcase,
  Image as ImageIcon,
  Ticket,
  LogOut,
  Search,
  Menu,
  X,
} from "lucide-react";
import { useUserStore } from "../../stores/userStore";
import { toast } from 'react-toastify';
const DashboardLayout: React.FC = () => {
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "superAdmin"; // Check for superAdmin
  
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const handleLogout = () => {

        logout();
        toast.success("Du har blitt logget ut");
        navigate("/");

  };
  return (
    <div className="flex !mt-[-70px]">
      {/* Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* --- Sidebar --- */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col p-6 transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        {/* Logo Section */}
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-800 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
              J
            </div>
            <span className="text-2xl font-bold text-green-900 tracking-tight">
              Jobblo.
            </span>
          </div>
          <div className="md:hidden">
            <button className="p-1" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-2 flex-1">
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            to="/dashboard"
            end
          />

          {/* PROTECTED LINK: Only for superAdmin */}
          {isSuperAdmin && (
            <SidebarItem
              icon={<Users size={20} />}
              label="Users"
              to="/dashboard/users"
            />
          )}

          <SidebarItem
            icon={<Briefcase size={20} />}
            label="Services"
            to="/dashboard/services"
          />
          
          <SidebarItem
            icon={<ImageIcon size={20} />}
            label="Carousel"
            to="/dashboard/carousel"
          />

          {/* PROTECTED LINK: Only for superAdmin */}
          {isSuperAdmin && (
            <SidebarItem
              icon={<Ticket size={20} />}
              label="Voucher"
              to="/dashboard/voucher"
            />
          )}
        </nav>

        {/* Logout Button */}
        <button className="flex items-center gap-3 text-gray-400 hover:text-red-600 font-medium p-3 transition-colors mt-auto border-t pt-6" onClick={handleLogout}>
          <LogOut size={20} />
          Logout
        </button>
      </aside>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-20 bg-white border-b flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="md:hidden">
              <button
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu size={24} />
              </button>
            </div>
            {/* Search Bar */}
            <div className="relative w-full max-w-md hidden sm:block">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Search anything..."
                className="w-full pl-12 pr-4 py-2.5 rounded-full border border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-green-500/10 focus:border-green-800 outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          {/* User Profile Info */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-gray-800">{user?.name || "Admin"}</p>
              <p className="text-[10px] text-gray-400 font-medium capitalize">
                {user?.role || "Administrator"}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-green-800/20 p-0.5">
              <img
                src={`https://ui-avatars.com/api/?name=${user?.name || 'Admin'}&background=2d4a3e&color=fff`}
                className="rounded-full"
                alt="profile"
              />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar bg-[#f8f9fa]">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

// --- SidebarItem Component ---
interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  to: string;
  end?: boolean;
}

const SidebarItem = ({ icon, label, to, end = false }: SidebarItemProps) => (
  <NavLink
    to={to}
    end={end}
    className={({ isActive }) => `
      flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group
      ${
        isActive
          ? "bg-[#2d4a3e] text-white shadow-md shadow-green-900/20"
          : "!text-black hover:bg-gray-50 hover:text-green-900"
      }
    `}
  >
    <span className="transition-transform group-hover:scale-110">{icon}</span>
    <span className="font-bold text-sm tracking-tight">{label}</span>
  </NavLink>
);

export default DashboardLayout;