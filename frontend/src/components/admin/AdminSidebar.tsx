import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    Briefcase,
    ShoppingCart,
    CreditCard,
    Bell,
    Image as ImageIcon,
    Ticket,
    Rocket,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    LogOut,
    X,
    Star,
    Tag,
    Shield,
    AlertTriangle,
    MessageSquare,
    Flag,
    Eye,
} from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { toast } from 'sonner';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { cn } from '@/lib/utils';

// ─── Nav structure ────────────────────────────────────────────────────────────
interface NavItem {
    label: string;
    to: string;
    icon: React.ReactNode;
    end?: boolean;
}

interface NavGroup {
    label: string;
    items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
    {
        label: 'Oversikt',
        items: [
            { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} />, end: true },
        ],
    },
    {
        label: 'Markedsplass',
        items: [
            { label: 'Tjenester', to: '/dashboard/services', icon: <Briefcase size={18} /> },
            { label: 'Ordrer', to: '/dashboard/orders', icon: <ShoppingCart size={18} /> },
            { label: 'Vurderinger', to: '/dashboard/reviews', icon: <Star size={18} /> },
            { label: 'Kategorier', to: '/dashboard/categories', icon: <Tag size={18} /> },
        ],
    },
    {
        label: 'Brukere',
        items: [
            { label: 'Alle brukere', to: '/dashboard/users', icon: <Users size={18} /> },
        ],
    },
    {
        label: 'Økonomi',
        items: [
            { label: 'Transaksjoner', to: '/dashboard/transactions', icon: <CreditCard size={18} /> },
            { label: 'SafePay', to: '/dashboard/safepay', icon: <Shield size={18} /> },
            { label: 'Tvister', to: '/dashboard/disputes', icon: <AlertTriangle size={18} /> },
            { label: 'Abonnementer', to: '/dashboard/plans', icon: <ShieldCheck size={18} /> },
            { label: 'Kuponger', to: '/dashboard/voucher', icon: <Ticket size={18} /> },
        ],
    },
    {
        label: 'Innhold',
        items: [
            { label: 'Varslinger', to: '/dashboard/notifications', icon: <Bell size={18} /> },
            { label: 'Hjem Hero', to: '/dashboard/home-hero', icon: <ImageIcon size={18} /> },
            { label: 'Karusell', to: '/dashboard/carousel', icon: <ImageIcon size={18} /> },
            { label: 'Veikart', to: '/dashboard/roadmap', icon: <Rocket size={18} /> },
        ],
    },
    {
        label: 'System',
        items: [
            { label: 'Chat-gjennomgang', to: '/dashboard/chat-review', icon: <Eye size={18} /> },
            { label: 'Chatter', to: '/dashboard/chats', icon: <MessageSquare size={18} /> },
            { label: 'Chatrapporter', to: '/dashboard/chat-reports', icon: <Flag size={18} /> },
            { label: 'Aktivitetslogg', to: '/dashboard/activity', icon: <ShieldCheck size={18} /> },
        ],
    },
];

// ─── SidebarLink ─────────────────────────────────────────────────────────────
function SidebarLink({
    item,
    collapsed,
}: {
    item: NavItem;
    collapsed: boolean;
}) {
    return (
        <NavLink
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
                cn(
                    'flex items-center gap-3 rounded-xl transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50',
                    collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5',
                    isActive
                        ? 'bg-[#2d4a3e] text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )
            }
            aria-label={item.label}
        >
            <span className="shrink-0">{item.icon}</span>
            {!collapsed && (
                <span className="text-sm font-medium truncate">{item.label}</span>
            )}
        </NavLink>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface AdminSidebarProps {
    mobileOpen: boolean;
    onMobileClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function AdminSidebar({ mobileOpen, onMobileClose }: AdminSidebarProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [showLogout, setShowLogout] = useState(false);
    const logout = useUserStore((s) => s.logout);
    const user = useUserStore((s) => s.user);
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        toast.success('Du har blitt logget ut.');
        navigate('/login');
    };

    const sidebarContent = (
        <div className="flex flex-col h-full">
            {/* Logo + collapse toggle */}
            <div className={cn('flex items-center mb-6', collapsed ? 'justify-center' : 'justify-between')}>
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#2d4a3e] rounded-xl flex items-center justify-center text-white font-black text-sm shadow">
                            J
                        </div>
                        <span className="text-lg font-black text-gray-900 tracking-tight">Jobblo</span>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed((c) => !c)}
                    className="hidden md:flex p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50"
                    aria-label={collapsed ? 'Utvid sidepanel' : 'Skjul sidepanel'}
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                {/* Mobile close */}
                <button
                    onClick={onMobileClose}
                    className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    aria-label="Lukk sidepanel"
                >
                    <X size={18} />
                </button>
            </div>

            {/* Nav groups */}
            <nav className="flex-1 overflow-y-auto space-y-5 pr-1" aria-label="Adminnavigasjon">
                {NAV_GROUPS.map((group) => (
                    <div key={group.label}>
                        {!collapsed && (
                            <p className="px-3 mb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                                {group.label}
                            </p>
                        )}
                        <div className="space-y-0.5">
                            {group.items.map((item) => (
                                <SidebarLink key={item.to} item={item} collapsed={collapsed} />
                            ))}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Admin profile + logout */}
            <div className={cn('pt-4 mt-4 border-t border-gray-100', collapsed && 'flex flex-col items-center gap-2')}>
                {!collapsed && (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl mb-2">
                        <img
                            src={
                                user?.avatarUrl ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'A')}&background=2d4a3e&color=fff&size=64`
                            }
                            alt={user?.name || 'Admin'}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">
                                {user?.name || 'Super Admin'}
                            </p>
                            <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
                        </div>
                    </div>
                )}

                <AdminConfirmDialog
                    title="Logg ut?"
                    description="Er du sikker på at du vil logge ut av admindashbordet?"
                    confirmText="Ja, logg ut"
                    cancelText="Avbryt"
                    variant="destructive"
                    isOpen={showLogout}
                    onOpenChange={setShowLogout}
                    onConfirm={handleLogout}
                    trigger={
                        <button
                            className={cn(
                                'flex items-center gap-3 w-full rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50',
                                collapsed ? 'p-2.5 justify-center' : 'px-3 py-2.5'
                            )}
                            aria-label="Logg ut"
                            title={collapsed ? 'Logg ut' : undefined}
                        >
                            <LogOut size={18} />
                            {!collapsed && <span className="text-sm font-medium">Logg ut</span>}
                        </button>
                    }
                />
            </div>
        </div>
    );

    return (
        <>
            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden"
                    onClick={onMobileClose}
                    aria-hidden="true"
                />
            )}

            {/* Mobile drawer */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-100 p-4 transition-transform duration-300 ease-in-out md:hidden',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    'w-64'
                )}
                aria-label="Sidepanel"
                role="navigation"
            >
                {sidebarContent}
            </aside>

            {/* Desktop sidebar */}
            <aside
                className={cn(
                    'hidden md:flex flex-col bg-white border-r border-gray-100 p-4 transition-all duration-300 ease-in-out shrink-0',
                    collapsed ? 'w-[68px]' : 'w-60'
                )}
                aria-label="Sidepanel"
            >
                {sidebarContent}
            </aside>
        </>
    );
}
