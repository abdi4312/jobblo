import { Menu, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useUserStore } from '../../stores/userStore';

interface AdminHeaderProps {
    onMobileMenuOpen: () => void;
}

// Simple breadcrumb from pathname
function useBreadcrumbs() {
    const location = useLocation();
    const segments = location.pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);

    const labels: Record<string, string> = {
        users: 'Brukere',
        services: 'Tjenester',
        orders: 'Ordrer',
        transactions: 'Transaksjoner',
        notifications: 'Varslinger',
        voucher: 'Kuponger',
        carousel: 'Karusell',
        'home-hero': 'Hjem Hero',
        roadmap: 'Veikart',
        plans: 'Abonnementer',
        reviews: 'Vurderinger',
        categories: 'Kategorier',
        activity: 'Aktivitetslogg',
        settings: 'Innstillinger',
    };

    const crumbs = [{ label: 'Dashboard', to: '/dashboard' }];
    segments.forEach((seg) => {
        crumbs.push({ label: labels[seg] ?? seg, to: '' });
    });

    return crumbs;
}

export function AdminHeader({ onMobileMenuOpen }: AdminHeaderProps) {
    const user = useUserStore((s) => s.user);
    const breadcrumbs = useBreadcrumbs();

    return (
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 shrink-0">
            {/* Left: mobile toggle + breadcrumbs */}
            <div className="flex items-center gap-3 min-w-0">
                <button
                    className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    onClick={onMobileMenuOpen}
                    aria-label="Åpne sidepanel"
                >
                    <Menu size={20} />
                </button>

                <nav aria-label="Sti" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
                    {breadcrumbs.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1.5 min-w-0">
                            {i > 0 && <span className="text-gray-300" aria-hidden="true">/</span>}
                            <span
                                className={
                                    i === breadcrumbs.length - 1
                                        ? 'font-semibold text-gray-800 truncate'
                                        : 'text-gray-400 truncate'
                                }
                            >
                                {crumb.label}
                            </span>
                        </span>
                    ))}
                </nav>
            </div>

            {/* Right: notification placeholder + profile */}
            <div className="flex items-center gap-2 shrink-0">
                {/* Notification bell — placeholder until notification API is wired */}
                <button
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#2d4a3e]/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Varslinger (ikke tilgjengelig ennå)"
                    disabled
                >
                    <Bell size={18} />
                </button>

                {/* Admin avatar */}
                <div className="flex items-center gap-2.5">
                    <img
                        src={
                            user?.avatarUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'A')}&background=2d4a3e&color=fff&size=64`
                        }
                        alt={user?.name || 'Admin'}
                        className="w-8 h-8 rounded-full object-cover border-2 border-gray-100"
                    />
                    <div className="hidden sm:block text-right">
                        <p className="text-sm font-semibold text-gray-800 leading-tight">
                            {user?.name || 'Admin'}
                        </p>
                        <p className="text-[11px] text-gray-400">Super Admin</p>
                    </div>
                </div>
            </div>
        </header>
    );
}
