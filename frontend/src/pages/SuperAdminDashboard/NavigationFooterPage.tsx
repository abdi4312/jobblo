import { useState, useEffect } from 'react';
import { Save, RefreshCw, Link, Mail, Globe, Copyright } from 'lucide-react';
import { useNavigation, useUpdateNavigation, useFooter, useUpdateFooter } from '../../hooks/admin/content';
import { AdminPageHeader, AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';
import { toast } from 'react-hot-toast';

const parseLines = (str: string): { label: string; url: string }[] =>
  str.split('\n').filter(Boolean).map(line => {
    const [label = '', url = ''] = line.split('|').map(s => s.trim());
    return { label, url };
  });

const formatLines = (items: { label?: string; url?: string }[]): string =>
  items?.map(i => `${i.label || ''} | ${i.url || ''}`).join('\n') || '';

export default function NavigationFooterPage() {
  const { data: navData, isLoading: navLoading, isError: navError, refetch: refetchNav } = useNavigation();
  const { data: footerData, isLoading: footerLoading, isError: footerError, refetch: refetchFooter } = useFooter();
  const updateNavMutation = useUpdateNavigation();
  const updateFooterMutation = useUpdateFooter();

  const [navForm, setNavForm] = useState({
    headerLinks: '',
    footerLinks: '',
    socialLinks: '',
  });

  const [footerForm, setFooterForm] = useState({
    contactEmail: '',
    supportEmail: '',
    copyrightText: '',
    aboutText: '',
  });

  useEffect(() => {
    if (navData) {
      setNavForm({
        headerLinks: formatLines((navData.headerLinks as { label?: string; url?: string }[]) ?? []),
        footerLinks: formatLines((navData.footerLinks as { label?: string; url?: string }[]) ?? []),
        socialLinks: formatLines((navData.socialLinks as { label?: string; url?: string }[]) ?? []),
      });
    }
  }, [navData]);

  useEffect(() => {
    if (footerData) {
      setFooterForm({
        contactEmail: (footerData.contactEmail as string) ?? '',
        supportEmail: (footerData.supportEmail as string) ?? '',
        copyrightText: (footerData.copyrightText as string) ?? '',
        aboutText: (footerData.aboutText as string) ?? '',
      });
    }
  }, [footerData]);

  const handleNavChange = (field: string) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNavForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleFooterChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFooterForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSaveNav = async () => {
    try {
      await updateNavMutation.mutateAsync({
        headerLinks: parseLines(navForm.headerLinks),
        footerLinks: parseLines(navForm.footerLinks),
        socialLinks: parseLines(navForm.socialLinks),
      });
      toast.success('Navigasjon oppdatert.');
    } catch {
      toast.error('Kunne ikke oppdatere navigasjon.');
    }
  };

  const handleSaveFooter = async () => {
    try {
      await updateFooterMutation.mutateAsync({
        contactEmail: footerForm.contactEmail,
        supportEmail: footerForm.supportEmail,
        copyrightText: footerForm.copyrightText,
        aboutText: footerForm.aboutText,
      });
      toast.success('Footer oppdatert.');
    } catch {
      toast.error('Kunne ikke oppdatere footer.');
    }
  };

  const isLoading = navLoading || footerLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Navigasjon & Footer" description="Administrer navigasjonslenker og footer-innhold" />
        <AdminLoadingSkeleton rows={8} />
      </div>
    );
  }

  if (navError || footerError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Navigasjon & Footer" description="Administrer navigasjonslenker og footer-innhold" />
        <AdminErrorState onRetry={() => { refetchNav(); refetchFooter(); }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Navigasjon & Footer"
        description="Administrer navigasjonslenker og footer-innhold"
        actions={
          <button
            onClick={() => { refetchNav(); refetchFooter(); }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground bg-muted hover:bg-accent rounded-md transition-colors"
          >
            <RefreshCw size={16} />
            Oppdater
          </button>
        }
      />

      {/* Navigasjon */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Link size={16} />
            Navigasjon
          </div>
          <button
            onClick={handleSaveNav}
            disabled={updateNavMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {updateNavMutation.isPending ? 'Lagrer...' : 'Lagre navigasjon'}
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Header-lenker (én per linje: Tittel | /url)</label>
          <textarea
            value={navForm.headerLinks}
            onChange={handleNavChange('headerLinks')}
            placeholder="Stillinger | /jobs&#10;Tjenester | /services&#10;Om oss | /about"
            rows={4}
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px] font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Footer-lenker (én per linje: Tittel | /url)</label>
          <textarea
            value={navForm.footerLinks}
            onChange={handleNavChange('footerLinks')}
            placeholder="Personvern | /privacy&#10;Vilkår | /terms&#10;Kontakt | /contact"
            rows={4}
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px] font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Sosiale medier (én per linje: Platform | https://...)</label>
          <textarea
            value={navForm.socialLinks}
            onChange={handleNavChange('socialLinks')}
            placeholder="Facebook | https://facebook.com/..."
            rows={3}
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px] font-mono"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="bg-card rounded-lg border border-border p-5 space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
            <Globe size={16} />
            Footer
          </div>
          <button
            onClick={handleSaveFooter}
            disabled={updateFooterMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {updateFooterMutation.isPending ? 'Lagrer...' : 'Lagre footer'}
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Kontakt-e-post</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={footerForm.contactEmail}
              onChange={handleFooterChange('contactEmail')}
              placeholder="kontakt@example.no"
              className="flex h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Support-e-post</label>
          <div className="relative">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={footerForm.supportEmail}
              onChange={handleFooterChange('supportEmail')}
              placeholder="support@example.no"
              className="flex h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Copyright-tekst</label>
          <div className="relative">
            <Copyright size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={footerForm.copyrightText}
              onChange={handleFooterChange('copyrightText')}
              placeholder="© 2026 Jobblo. Alle rettigheter reservert."
              className="flex h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-foreground">Om-tekst</label>
          <textarea
            value={footerForm.aboutText}
            onChange={handleFooterChange('aboutText')}
            placeholder="Jobblo er Norges ledende jobbplattform..."
            rows={4}
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px]"
          />
        </div>
      </div>
    </div>
  );
}
