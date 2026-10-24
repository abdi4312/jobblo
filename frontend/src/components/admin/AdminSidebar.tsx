import { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Briefcase,
  ChevronsUpDown,
  CreditCard,
  Eye,
  Flag,
  Globe,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Receipt,
  Rocket,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingCart,
  Star,
  Tag,
  Terminal,
  Ticket,
  Users,
  WalletCards,
  Wrench,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useUserStore } from '../../stores/userStore';
import { useTranslate } from '../../i18n/useTranslate';
import { AdminConfirmDialog } from './AdminConfirmDialog';
import { Avatar, AvatarFallback, AvatarImage } from '../developer/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../developer/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '../developer/ui/sidebar';

interface AdminNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Super Admin navigation. System health, error logs, activity log and feature flags moved to
 * the Developer Console (/developer), so they are not listed here any more.
 */
export function useAdminNav(): AdminNavGroup[] {
  const { t } = useTranslate();
  return [
    {
      label: t('nav.oversikt'),
      items: [{ label: t('nav.dashboard'), to: '/dashboard', icon: LayoutDashboard, end: true }],
    },
    {
      label: t('nav.markedsplass'),
      items: [
        { label: t('nav.tjenester'), to: '/dashboard/services', icon: Briefcase },
        { label: t('nav.ordrer'), to: '/dashboard/orders', icon: ShoppingCart },
        { label: t('nav.vurderinger'), to: '/dashboard/reviews', icon: Star },
        { label: t('nav.kategorier'), to: '/dashboard/categories', icon: Tag },
      ],
    },
    {
      label: t('nav.brukere'),
      items: [{ label: t('nav.alle_brukere'), to: '/dashboard/users', icon: Users }],
    },
    {
      label: t('nav.okonomi'),
      items: [
        { label: t('nav.transaksjoner'), to: '/dashboard/transactions', icon: CreditCard },
        { label: t('nav.safepay'), to: '/dashboard/safepay', icon: Shield },
        { label: 'Stripe-historikk', to: '/dashboard/finance-history', icon: WalletCards },
        { label: t('nav.tvister'), to: '/dashboard/disputes', icon: AlertTriangle },
        { label: t('nav.abonnementer'), to: '/dashboard/plans', icon: ShieldCheck },
        { label: 'Fakturering', to: '/dashboard/subscription-billing', icon: Receipt },
        { label: t('nav.kuponger'), to: '/dashboard/voucher', icon: Ticket },
      ],
    },
    {
      label: t('nav.innhold'),
      items: [
        { label: t('nav.varslinger'), to: '/dashboard/notifications', icon: Bell },
        { label: t('nav.hjemmeside_cms'), to: '/dashboard/homepage-cms', icon: Globe },
        { label: 'Kampanjer', to: '/dashboard/campaigns', icon: Megaphone },
        { label: t('nav.navigasjon_footer'), to: '/dashboard/navigation-footer', icon: Menu },
        { label: t('nav.kunngjoringer'), to: '/dashboard/announcements', icon: Megaphone },
        { label: t('nav.shop'), to: '/dashboard/shop', icon: ShoppingCart },
        { label: t('nav.veikart'), to: '/dashboard/roadmap', icon: Rocket },
      ],
    },
    {
      label: t('nav.moderering'),
      items: [
        { label: t('nav.chat_gjennomgang'), to: '/dashboard/chat-review', icon: Eye },
        { label: t('nav.chatter'), to: '/dashboard/chats', icon: MessageSquare },
        { label: t('nav.chatrapporter'), to: '/dashboard/chat-reports', icon: Flag },
        { label: t('nav.jobrapporter'), to: '/dashboard/job-reports', icon: AlertTriangle },
      ],
    },
    {
      label: t('nav.operations'),
      items: [
        { label: t('nav.globale_instillinger'), to: '/dashboard/settings', icon: Settings },
        { label: t('nav.vedlikeholdsmodus'), to: '/dashboard/maintenance', icon: Wrench },
        { label: 'Server', to: '/dashboard/system-health', icon: Server },
      ],
    },
  ];
}

/** shadcn sidebar in the same style as the Developer Console. */
export function AdminSidebar() {
  const groups = useAdminNav();
  const { pathname } = useLocation();
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const navigate = useNavigate();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const initials = (user?.name || '?').slice(0, 2).toUpperCase();
  const isActive = (item: AdminNavItem) =>
    item.end ? pathname === item.to || pathname === `${item.to}/` : pathname === item.to || pathname.startsWith(`${item.to}/`);

  const handleLogout = async () => {
    await logout();
    toast.success('Du har blitt logget ut.');
    navigate('/login');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Jobblo</span>
                  <span className="truncate text-xs text-muted-foreground">Super Admin</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive(item)} tooltip={item.label}>
                      <NavLink to={item.to} end={item.end}>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <Avatar className="size-8 rounded-md">
                    <AvatarImage src={user?.avatarUrl} alt="" />
                    <AvatarFallback className="rounded-md text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="min-w-56">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Logget inn som <span className="font-medium text-foreground">Super Admin</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/home')}>
                  <ArrowLeft /> Til Jobblo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/developer')}>
                  <Terminal /> Developer Console
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmLogout(true)}>
                  <LogOut /> Logg ut
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />

      <AdminConfirmDialog
        isOpen={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Logg ut?"
        description="Vil du logge ut av administrasjonspanelet?"
        confirmText="Logg ut"
        variant="destructive"
        onConfirm={handleLogout}
      />
    </Sidebar>
  );
}
