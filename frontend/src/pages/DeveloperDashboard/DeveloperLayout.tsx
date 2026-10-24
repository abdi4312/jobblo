import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { ArrowLeft, ChevronsUpDown, Command as CommandIcon, LogOut, Search, ShieldCheck, Terminal } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useDevPrefs } from '../../features/developer/hooks';
import { DEV_NAV, DEV_NAV_ITEMS, activeNavPath } from './nav';
import { LiveDot } from '../../components/developer/kit';
import { Badge } from '../../components/developer/ui/badge';
import { Button } from '../../components/developer/ui/button';
import { Label } from '../../components/developer/ui/label';
import { Separator } from '../../components/developer/ui/separator';
import { Switch } from '../../components/developer/ui/switch';
import { TooltipProvider } from '../../components/developer/ui/tooltip';
import { StepUpProvider } from '../../components/developer/StepUp';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/developer/ui/avatar';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../../components/developer/ui/breadcrumb';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../../components/developer/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/developer/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from '../../components/developer/ui/sidebar';

const ENV = import.meta.env.PROD ? (window.location.hostname.includes('staging') ? 'staging' : 'production') : 'development';
const ENV_CLASS: Record<string, string> = {
  production: 'border-red-200/70 bg-red-50 text-red-700',
  staging: 'border-amber-200/70 bg-amber-50 text-amber-700',
  development: 'border-sky-200/70 bg-sky-50 text-sky-700',
};

function useBodyTheme() {
  useEffect(() => {
    document.body.classList.add('dev-theme');
    return () => document.body.classList.remove('dev-theme');
  }, []);
}

function DevSidebar() {
  const active = activeNavPath(useLocation().pathname);
  const user = useUserStore((s) => s.user);
  const logout = useUserStore((s) => s.logout);
  const navigate = useNavigate();
  const initials = (user?.name || '?').slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/developer">
                <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Terminal className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">Jobblo</span>
                  <span className="truncate text-xs text-muted-foreground">Developer Console</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {DEV_NAV.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={active === item.path}
                      tooltip={item.label}
                      className={item.planned ? 'text-muted-foreground' : undefined}
                    >
                      <NavLink to={item.path ? `/developer/${item.path}` : '/developer'} end>
                        <item.icon />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.planned && (
                      <SidebarMenuBadge className="rounded-sm border bg-muted px-1 text-[10px] font-normal text-muted-foreground">Planned</SidebarMenuBadge>
                    )}
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
                  Signed in as <span className="font-medium text-foreground capitalize">{user?.role}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/home')}>
                  <ArrowLeft /> Back to Jobblo
                </DropdownMenuItem>
                {user?.role === 'superAdmin' && (
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <ShieldCheck /> Admin dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={async () => {
                    await logout();
                    navigate('/login');
                  }}
                >
                  <LogOut /> Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const go = (to: string) => {
    setOpen(false);
    setQuery('');
    navigate(to);
  };
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Jump to" description="Search pages or investigate any ID">
      <CommandInput placeholder="Search pages, or paste any ID, Stripe ref, email or IP…" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No matching page.</CommandEmpty>
        {query.trim().length >= 6 && (
          <>
            <CommandGroup heading="Lookup">
              <CommandItem value={`investigate ${query}`} onSelect={() => go(`/developer/investigate?q=${encodeURIComponent(query.trim())}`)}>
                <Search /> Investigate <span className="font-mono text-xs">{query.trim()}</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {DEV_NAV.map((g) => (
          <CommandGroup key={g.label} heading={g.label}>
            {g.items.map((i) => (
              <CommandItem key={i.path} value={`${i.label} ${i.description}`} onSelect={() => go(`/developer/${i.path}`)}>
                <i.icon />
                <span>{i.label}</span>
                {i.planned && <span className="ml-auto text-[10px] text-muted-foreground">Planned</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export default function DeveloperLayout() {
  useBodyTheme();
  const location = useLocation();
  const { autoRefresh, setAutoRefresh } = useDevPrefs();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const activePath = activeNavPath(location.pathname);
  const current = DEV_NAV_ITEMS.find((i) => i.path === activePath);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <StepUpProvider>
        <SidebarProvider>
          <DevSidebar />
          <SidebarInset className="min-w-0 bg-background">
            <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
              <Breadcrumb className="min-w-0">
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden sm:block">
                    <BreadcrumbLink asChild>
                      <Link to="/developer">Developer</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="truncate">{current?.label || 'Overview'}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" className="hidden w-56 justify-start bg-card text-muted-foreground md:inline-flex" onClick={() => setPaletteOpen(true)}>
                  <Search />
                  <span className="flex-1 text-left">Search or investigate…</span>
                  <kbd className="pointer-events-none inline-flex h-5 items-center gap-0.5 rounded-sm border bg-muted px-1 font-mono text-[10px]">
                    <CommandIcon className="size-3" />K
                  </kbd>
                </Button>
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
                  <Search />
                </Button>
                <div className="flex items-center gap-2 rounded-md border bg-card px-2 py-1">
                  <LiveDot on={autoRefresh} />
                  <Label htmlFor="dev-auto-refresh" className="hidden text-xs font-normal text-muted-foreground sm:inline">
                    Auto-refresh
                  </Label>
                  <Switch
                    id="dev-auto-refresh"
                    size="sm"
                    checked={autoRefresh}
                    onCheckedChange={(v) => {
                      setAutoRefresh(v);
                      toast(v ? 'Auto-refresh on' : 'Auto-refresh paused');
                    }}
                    aria-label="Auto-refresh"
                  />
                </div>
                <Badge variant="outline" className={`hidden capitalize sm:inline-flex ${ENV_CLASS[ENV]}`}>
                  {ENV}
                </Badge>
              </div>
            </header>

            <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 sm:p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </SidebarProvider>
      </StepUpProvider>
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
      <Toaster position="bottom-right" toastOptions={{ className: 'rounded-md text-sm' }} />
    </TooltipProvider>
  );
}
