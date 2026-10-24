import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Terminal } from 'lucide-react';
import { AdminSidebar, useAdminNav } from '../../components/admin/AdminSidebar';
import { LanguageSwitcher } from '../../components/admin/LanguageSwitcher';
import { LanguageProvider } from '../../i18n/LanguageContext';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Separator } from '../../components/developer/ui/separator';
import { TooltipProvider } from '../../components/developer/ui/tooltip';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../components/developer/ui/breadcrumb';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../../components/developer/ui/sidebar';

const ENV = import.meta.env.PROD ? (window.location.hostname.includes('staging') ? 'staging' : 'production') : 'development';
const ENV_CLASS: Record<string, string> = {
  production: 'border-red-200/70 bg-red-50 text-red-700',
  staging: 'border-amber-200/70 bg-amber-50 text-amber-700',
  development: 'border-sky-200/70 bg-sky-50 text-sky-700',
};

/** Same shadcn look as the Developer Console: the `dev-theme` palette on <body>. */
function useBodyTheme() {
  useEffect(() => {
    document.body.classList.add('dev-theme');
    return () => document.body.classList.remove('dev-theme');
  }, []);
}

function AdminShell() {
  useBodyTheme();
  const { pathname } = useLocation();
  const items = useAdminNav().flatMap((group) => group.items);
  // Longest matching nav path wins, so /dashboard/safepay/123 shows "SafePay".
  const current = items
    .filter((item) => (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset className="min-w-0 bg-background" translate="no">
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <Breadcrumb className="min-w-0">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:block">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Admin</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="truncate">{current?.label || 'Dashboard'}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" asChild className="hidden bg-card md:inline-flex">
                <Link to="/developer">
                  <Terminal /> Developer Console
                </Link>
              </Button>
              <LanguageSwitcher />
              <Badge variant="outline" className={`hidden capitalize sm:inline-flex ${ENV_CLASS[ENV]}`}>
                {ENV}
              </Badge>
            </div>
          </header>

          <main id="main-content" aria-label="Hovedinnhold" className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export default function DashboardLayout() {
  return (
    <LanguageProvider>
      <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: '8px', fontSize: '14px' } }} />
      <AdminShell />
    </LanguageProvider>
  );
}
