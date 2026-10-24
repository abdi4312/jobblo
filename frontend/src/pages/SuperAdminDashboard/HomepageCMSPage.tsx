import { useState, useEffect } from 'react';
import { Save, RefreshCw, Image, Link, Type, MessageSquare } from 'lucide-react';
import { useHomepageContent, useUpdateHomepageContent } from '../../hooks/admin/content';
import { AdminPageHeader, AdminLoadingSkeleton, AdminErrorState } from '../../components/admin';
import { toast } from 'react-hot-toast';

export default function HomepageCMSPage() {
  const { data: content, isLoading, isError, refetch } = useHomepageContent();
  const updateMutation = useUpdateHomepageContent();

  const [form, setForm] = useState({
    heroTitle: '',
    heroSubtitle: '',
    heroDescription: '',
    ctaText: '',
    ctaUrl: '',
    featuredCategories: '',
    announcementBanner: '',
  });

  useEffect(() => {
    if (content) {
      setForm({
        heroTitle: content.heroTitle ?? '',
        heroSubtitle: content.heroSubtitle ?? '',
        heroDescription: content.heroDescription ?? '',
        ctaText: content.ctaText ?? '',
        ctaUrl: content.ctaUrl ?? '',
        featuredCategories: Array.isArray(content.featuredCategories)
          ? content.featuredCategories.map((c: unknown) => JSON.stringify(c)).join('\n')
          : typeof content.featuredCategories === 'string'
            ? content.featuredCategories
            : '',
        announcementBanner: content.announcementBanner ?? '',
      });
    }
  }, [content]);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let featuredCategories: unknown[] = [];
      if (form.featuredCategories.trim()) {
        featuredCategories = form.featuredCategories
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            try {
              return JSON.parse(line);
            } catch {
              return line;
            }
          });
      }

      await updateMutation.mutateAsync({
        heroTitle: form.heroTitle,
        heroSubtitle: form.heroSubtitle,
        heroDescription: form.heroDescription,
        ctaText: form.ctaText,
        ctaUrl: form.ctaUrl,
        featuredCategories,
        announcementBanner: form.announcementBanner,
      });
      toast.success('Hjemmesideinnhold oppdatert.');
    } catch {
      toast.error('Kunne ikke oppdatere hjemmesideinnhold.');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Hjemmeside CMS" description="Administrer innholdet på offentlige hjemmeside" />
        <AdminLoadingSkeleton rows={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Hjemmeside CMS" description="Administrer innholdet på offentlige hjemmeside" />
        <AdminErrorState onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Hjemmeside CMS"
        description="Administrer innholdet på offentlige hjemmeside"
        actions={
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground bg-muted hover:bg-accent rounded-md transition-colors"
          >
            <RefreshCw size={16} />
            Oppdater
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-card rounded-lg border border-border p-5 space-y-5">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm border-b border-border pb-3">
            <Type size={16} />
            Hero-seksjon
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Hero-tittel</label>
            <input
              value={form.heroTitle}
              onChange={handleChange('heroTitle')}
              placeholder="F.eks. Finn din neste jobb"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Hero-underrubrikk</label>
            <input
              value={form.heroSubtitle}
              onChange={handleChange('heroSubtitle')}
              placeholder="F.eks. Utforsk tusenvis av stillinger"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Hero-beskrivelse</label>
            <textarea
              value={form.heroDescription}
              onChange={handleChange('heroDescription')}
              placeholder="F.eks. Bli med i dag og oppdag mulighetene"
              rows={3}
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[80px]"
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-5">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm border-b border-border pb-3">
            <Link size={16} />
            CTA (Call to Action)
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">CTA-tekst</label>
            <input
              value={form.ctaText}
              onChange={handleChange('ctaText')}
              placeholder="F.eks. Se ledige stillinger"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">CTA-lenke</label>
            <input
              value={form.ctaUrl}
              onChange={handleChange('ctaUrl')}
              placeholder="F.eks. /jobs"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-5">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm border-b border-border pb-3">
            <Image size={16} />
            Fremhevede kategorier
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Kategorier (én JSON per linje)</label>
            <textarea
              value={form.featuredCategories}
              onChange={handleChange('featuredCategories')}
              placeholder='{"name":"Design","slug":"design","count":42}'
              rows={4}
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">Hver linje må være gyldig JSON. Én kategori per linje.</p>
          </div>
        </div>

        <div className="bg-card rounded-lg border border-border p-5 space-y-5">
          <div className="flex items-center gap-2 text-foreground font-semibold text-sm border-b border-border pb-3">
            <MessageSquare size={16} />
            Kunngjøringsbanner
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Bannertekst</label>
            <input
              value={form.announcementBanner}
              onChange={handleChange('announcementBanner')}
              placeholder="F.eks. Ny funksjon: Søk med AI!"
              className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {updateMutation.isPending ? 'Lagrer...' : 'Lagre innhold'}
          </button>
        </div>
      </form>
    </div>
  );
}
