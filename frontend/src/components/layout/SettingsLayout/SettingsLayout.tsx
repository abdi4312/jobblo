import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AtSign, Image, MapPin, Monitor, PenLine, Phone, User, CreditCard, ArrowLeft } from "lucide-react";
import { useUserStore } from "../../../stores/userStore";

export function SettingsLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const [showSidebar, setShowSidebar] = useState(true);

  // Handle sidebar visibility based on screen size and route
  useEffect(() => {
    const updateSidebarState = () => {
      const isMobile = window.innerWidth < 768;
      const isRootSettings = location.pathname === "/settings";

      if (!isMobile) {
        // Always show sidebar on desktop
        setShowSidebar(true);
      } else {
        // On mobile: show sidebar only on root settings page
        setShowSidebar(isRootSettings);
      }
    };

    // Initial check
    updateSidebarState();

    // Listen for resize
    window.addEventListener('resize', updateSidebarState);
    return () => window.removeEventListener('resize', updateSidebarState);
  }, [location.pathname]);

  const publicProfileLinks = [
    { name: "Username", path: "/settings", icon: AtSign },
    { name: "First and last name", path: "/settings/name", icon: User },
    { name: "Bio", path: "/settings/bio", icon: PenLine },
    { name: "Upload profile picture", path: "/settings/picture", icon: Image },
  ];

  const personalInfoLinks = [
    { name: "Email address", path: "/settings/email", icon: AtSign },
    { name: "Phone number", path: "/settings/phone", icon: Phone },
    { name: "My addresses", path: "/settings/addresses", icon: MapPin },
    { name: "Change password", path: "/settings/password", icon: User },
    { name: "Sessions", path: "/settings/sessions", icon: Monitor },
    { name: "Delete my profile", path: "/settings/delete-account", icon: User },
  ];

  const otherLinks = [
    { name: "Location", path: "/settings/location", icon: MapPin },
    { name: "Upcoming", path: "/settings/upcoming", icon: AtSign },
    { name: "Jobblo membership", path: "/membership", icon: AtSign },
    { name: "Subscriptions", path: "/settings/subscriptions", icon: CreditCard },
  ];

  const privacyLinks = [
    { name: "Search engine visibility", path: "/settings/visibility", icon: AtSign },
    { name: "Blocked users", path: "/settings/blocked", icon: User },
    { name: "Cookie settings", path: "/settings/cookies", icon: AtSign },
    { name: "About us", path: "/settings/about", icon: PenLine },
  ];

  const currentPath = location.pathname;

  // Find current active tab name
  const allLinks = [...publicProfileLinks, ...personalInfoLinks, ...otherLinks, ...privacyLinks];
  let activeTab = allLinks.find(link => link.path === currentPath)?.name || "Settings";

  // Special case for Blocked users to show count in header
  if (currentPath === "/settings/blocked" && user?.blockedUsers?.length > 0) {
    activeTab = `Blocked users (${user.blockedUsers.length})`;
  }

  const handleBackToSidebar = () => {
    setShowSidebar(true);
    navigate("/settings");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-0 flex justify-center">
      <div className="w-full max-w-5xl bg-white md:rounded-2xl shadow-sm md:border border-gray-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-row border-b border-gray-100">
          {/* Settings title - hidden on mobile when viewing content */}
          <div className={`${showSidebar ? 'flex' : 'hidden md:flex'} w-full md:w-64 p-4 sm:p-6 font-bold text-xl sm:text-lg text-gray-900 md:border-r border-gray-100 items-center justify-center md:justify-start`}>
            Settings
          </div>
          {/* Active tab title with back button */}
          <div className="flex-1 p-4 sm:p-6 font-semibold text-lg text-gray-800 flex items-center md:justify-start bg-white border-gray-100 min-w-0">
            {/* Mobile back button - only show when sidebar is hidden on small screens */}
            {!showSidebar && (
              <button
                onClick={handleBackToSidebar}
                className="md:hidden mr-3 p-2 -ml-2 hover:bg-gray-200 rounded-full transition-colors flex items-center justify-center shrink-0"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
            )}
            <span className="truncate">
              {activeTab}
            </span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-[400px] md:min-h-[600px]">
          {/* Sidebar - Hidden on mobile when viewing content */}
          <aside className={`${showSidebar ? 'flex' : 'hidden'} md:flex w-full md:w-64 border-b md:border-b-0 md:border-r border-gray-100 p-2 md:p-4 flex-col gap-4 md:gap-6 overflow-y-auto md:overflow-x-visible no-scrollbar`}>
            <div className="flex flex-col gap-4 md:gap-6 px-2 md:px-0">
              {[
                { title: "Public Profile", links: publicProfileLinks },
                { title: "Personal Information", links: personalInfoLinks },
                { title: "OTHER", links: otherLinks },
                { title: "PRIVACY AND TERMS", links: privacyLinks }
              ].map((group) => (
                <div key={group.title} className="flex flex-col gap-2 md:gap-1">
                  <div className="hidden md:block text-xs font-bold text-gray-400 uppercase mb-2 px-4 whitespace-nowrap">{group.title}</div>
                  {group.links.map((link) => {
                    const isActive = currentPath === link.path;
                    const Icon = link.icon;
                    return (
                      <button
                        key={link.path}
                        onClick={() => navigate(link.path)}
                        className={`flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${isActive
                          ? "bg-[#EF790933] text-rose-600 md:text-gray-900 shadow-sm md:shadow-none border border-rose-100 md:border-0"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent"
                          }`}
                      >
                        <Icon size={18} className={isActive ? "text-rose-500 md:text-gray-900" : "text-gray-500"} />
                        {link.name}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content Area - Full width on mobile when sidebar hidden */}
          <main className={`flex-1 p-4 sm:p-8 overflow-y-auto ${!showSidebar ? 'block' : 'hidden md:block'}`}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
