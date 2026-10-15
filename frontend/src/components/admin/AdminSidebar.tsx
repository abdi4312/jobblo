import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ShoppingCart,
  CreditCard,
  Bell,
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
  Settings,
  Globe,
  ToggleLeft,
  Server,
  Menu,
  Megaphone,
  Wrench,
  AlertCircle,
  WalletCards,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { toast } from 'react-hot-toast';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { cn } from '@/lib/utils';
import { useTranslate } from '../../i18n/useTranslate';

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

function useNavGroups(): NavGroup[] {
  const { t } = useTranslate();
  return [
    {
      label: t('nav.oversikt'),
      items: [
        {
          label: t('nav.dashboard'),
          to: '/dashboard',
          icon: <LayoutDashboard size={18} />,
          end: true,
        },
      ],
    },
    {
      label: t('nav.markedsplass'),
      items: [
        { label: t('nav.tjenester'), to: '/dashboard/services', icon: <Briefcase size={18} /> },
        { label: t('nav.ordrer'), to: '/dashboard/orders', icon: <ShoppingCart size={18} /> },
        { label: t('nav.vurderinger'), to: '/dashboard/reviews', icon: <Star size={18} /> },
        { label: t('nav.kategorier'), to: '/dashboard/categories', icon: <Tag size={18} /> },
      ],
    },
    {
      label: t('nav.brukere'),
      items: [{ label: t('nav.alle_brukere'), to: '/dashboard/users', icon: <Users size={18} /> }],
    },
    {
      label: t('nav.okonomi'),
      items: [
        {
          label: t('nav.transaksjoner'),
          to: '/dashboard/transactions',
          icon: <CreditCard size={18} />,
        },
        { label: t('nav.safepay'), to: '/dashboard/safepay', icon: <Shield size={18} /> },
        {
          label: 'Stripe-historikk',
          to: '/dashboard/finance-history',
          icon: <WalletCards size={18} />,
        },
        { label: t('nav.tvister'), to: '/dashboard/disputes', icon: <AlertTriangle size={18} /> },
        { label: t('nav.abonnementer'), to: '/dashboard/plans', icon: <ShieldCheck size={18} /> },
        {
          label: 'Fakturering',
          to: '/dashboard/subscription-billing',
          icon: <Receipt size={18} />,
        },
        { label: t('nav.kuponger'), to: '/dashboard/voucher', icon: <Ticket size={18} /> },
      ],
    },
    {
      label: t('nav.innhold'),
      items: [
        { label: t('nav.varslinger'), to: '/dashboard/notifications', icon: <Bell size={18} /> },
        {
          label: t('nav.hjemmeside_cms'),
          to: '/dashboard/homepage-cms',
          icon: <Globe size={18} />,
        },
        { label: 'Kampanjer', to: '/dashboard/campaigns', icon: <Megaphone size={18} /> },
        {
          label: t('nav.navigasjon_footer'),
          to: '/dashboard/navigation-footer',
          icon: <Menu size={18} />,
        },
        {
          label: t('nav.kunngjoringer'),
          to: '/dashboard/announcements',
          icon: <Megaphone size={18} />,
        },
        { label: t('nav.shop'), to: '/dashboard/shop', icon: <ShoppingCart size={18} /> },
        { label: t('nav.veikart'), to: '/dashboard/roadmap', icon: <Rocket size={18} /> },
      ],
    },
    {
      label: t('nav.moderering'),
      items: [
        { label: t('nav.chat_gjennomgang'), to: '/dashboard/chat-review', icon: <Eye size={18} /> },
        { label: t('nav.chatter'), to: '/dashboard/chats', icon: <MessageSquare size={18} /> },
        { label: t('nav.chatrapporter'), to: '/dashboard/chat-reports', icon: <Flag size={18} /> },
        {
          label: t('nav.jobrapporter'),
          to: '/dashboard/job-reports',
          icon: <AlertTriangle size={18} />,
        },
      ],
    },
    {
      label: t('nav.operations'),
      items: [
        { label: t('nav.systemhelse'), to: '/dashboard/system-health', icon: <Server size={18} /> },
        {
          label: t('nav.feil_logger'),
          to: '/dashboard/error-logs',
          icon: <AlertCircle size={18} />,
        },
        {
          label: t('nav.funksjonsflagg'),
          to: '/dashboard/feature-flags',
          icon: <ToggleLeft size={18} />,
        },
        {
          label: t('nav.globale_instillinger'),
          to: '/dashboard/settings',
          icon: <Settings size={18} />,
        },
        {
          label: t('nav.vedlikeholdsmodus'),
          to: '/dashboard/maintenance',
          icon: <Wrench size={18} />,
        },
        {
          label: t('nav.aktivitetslogg'),
          to: '/dashboard/activity',
          icon: <ShieldCheck size={18} />,
        },
      ],
    },
  ];
}

// ─── SidebarLink ─────────────────────────────────────────────────────────────
function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg border border-transparent transition-all duration-150 group focus:outline-none focus:ring-2 focus:ring-[#b9d4bf]/60',
          collapsed ? 'p-2 justify-center' : 'px-3 py-2.5',
          isActive
            ? 'bg-[#303238] text-white'
            : 'text-[#c2cec4] hover:bg-white/[0.06] hover:text-white'
        )
      }
      aria-label={item.label}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="text-sm font-medium truncate">{item.label}</span>}
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
  const NAV_GROUPS = useNavGroups();

  const handleLogout = async () => {
    await logout();
    toast.success('Du har blitt logget ut.');
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo + collapse toggle */}
      <div
        className="mb-3"
      >
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-[#d9e8d8] rounded-xl flex items-center justify-center text-[#1d3d2c] font-black text-sm shadow-sm">
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <div>
                <span className="text-lg font-black text-white tracking-tight">Jobblo</span>
                <p className="text-[9px] uppercase tracking-[0.2em] text-[#93a99a] font-semibold -mt-0.5">Admin Console</p>
              </div>
            )}
          </div>
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-[#93a99a] hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Lukk sidepanel"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative -mr-4 mt-1 hidden h-6 justify-end md:flex">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="absolute -right-2.5 flex h-6 w-6 items-center justify-center rounded-full border border-[#dfe3dc] bg-white text-[#2d4a3e] shadow-sm transition-colors hover:bg-[#f4f8f4] focus:outline-none focus:ring-2 focus:ring-[#b9d4bf]/70"
            aria-label={collapsed ? 'Utvid sidepanel' : 'Skjul sidepanel'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="no-scrollbar min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-contain space-y-6 pr-1" aria-label="Adminnavigasjon">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[9px] font-bold text-[#799080] uppercase tracking-[0.16em]">
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
      <div
        className={cn(
          'pt-4 mt-4 border-t border-white/10',
          collapsed && 'flex flex-col items-center gap-2'
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-3 rounded-xl mb-2 bg-white/[0.04]">
            <img
              src={
                user?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'A')}&background=2d4a3e&color=fff&size=64`
              }
              alt={user?.name || 'Admin'}
              className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-white/10"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || 'Super Admin'}
              </p>
              <p className="text-[11px] text-[#91a197] truncate">{user?.email}</p>
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
                'flex items-center gap-3 w-full rounded-xl text-[#a9b8ae] hover:text-white hover:bg-white/[0.07] transition-colors focus:outline-none focus:ring-2 focus:ring-red-400/50',
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
          className="fixed inset-0 bg-[#102017]/60 backdrop-blur-sm z-40 md:hidden"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 h-screen min-h-0 bg-[#172b21] border-r border-white/10 p-4 transition-transform duration-300 ease-in-out md:hidden',
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
          'relative hidden md:flex min-h-0 flex-col bg-[#172b21] border border-white/10 mx-2 my-3 rounded-xl p-2 transition-all duration-300 ease-in-out shrink-0',
          collapsed ? 'w-[68px]' : 'w-60'
        )}
        aria-label="Sidepanel"
      >
        {sidebarContent}
      </aside>
    </>
  );
}
