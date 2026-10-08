import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Gift, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchPublicCampaign, trackCampaignEvent } from '../../api/campaigns';
import { CONTAINER } from '../../theme/brand';

const storageGet = (storage: Storage, key: string) => {
  try { return storage.getItem(key); } catch { return null; }
};

const storageSet = (storage: Storage, key: string, value: string) => {
  try { storage.setItem(key, value); } catch { /* storage may be disabled */ }
};

export function CampaignExperience() {
  const { data } = useQuery({
    queryKey: ['public-campaign'],
    queryFn: fetchPublicCampaign,
    staleTime: 60_000,
    retry: 1,
  });
  const campaign = data?.campaign;
  const assignment = data?.assignment;
  const [open, setOpen] = useState(false);
  const isDialogOpen = useRef(false);
  const impressionSent = useRef(false);
  const closeMethod = useRef<'button' | 'backdrop' | 'escape' | null>(null);

  useEffect(() => {
    if (!campaign || !assignment) return;
    const seenKey = `jobblo:campaign:${campaign.id}:seen`;
    const cooldownKey = `jobblo:campaign:${campaign.id}:cooldown-until`;
    const cooldownUntil = Number(storageGet(window.localStorage, cooldownKey) || 0);
    if (storageGet(window.sessionStorage, seenKey) || cooldownUntil > Date.now()) return;

    const timer = window.setTimeout(() => {
      storageSet(window.sessionStorage, seenKey, '1');
      impressionSent.current = false;
      isDialogOpen.current = true;
      setOpen(true);
    }, campaign.popupDelayMs);
    return () => window.clearTimeout(timer);
  }, [campaign, assignment]);

  useEffect(() => {
    if (!open || !campaign || !assignment || impressionSent.current) return;
    impressionSent.current = true;
    void trackCampaignEvent(assignment.token, 'impression').catch(() => undefined);
  }, [open, campaign, assignment]);

  if (!campaign || !assignment) return null;

  const saveCooldown = () => {
    storageSet(
      window.localStorage,
      `jobblo:campaign:${campaign.id}:cooldown-until`,
      String(Date.now() + campaign.popupCooldownMs)
    );
  };

  const closePopup = (method: 'button' | 'backdrop' | 'escape') => {
    if (!isDialogOpen.current) return;
    isDialogOpen.current = false;
    closeMethod.current = null;
    saveCooldown();
    void trackCampaignEvent(assignment.token, 'close', method).catch(() => undefined);
    setOpen(false);
  };

  const recordCtaClick = () => {
    saveCooldown();
    isDialogOpen.current = false;
    void trackCampaignEvent(assignment.token, 'click').catch(() => undefined);
    setOpen(false);
  };

  const popupText = assignment.variant === 'A' ? campaign.popupVersionA : campaign.popupVersionB;

  return (
    <>
      <section className="bg-[#122A1C] text-white">
        <div className={`${CONTAINER} grid grid-cols-1 gap-2.5 py-3 sm:gap-4 sm:py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8 lg:py-3`}>
          <p className="min-w-0 max-w-3xl whitespace-normal wrap-break-word text-xs leading-5 text-pretty sm:text-sm sm:leading-relaxed">{campaign.bannerText}</p>
          <div className="flex min-w-0 flex-row items-center gap-4 lg:shrink-0 lg:justify-end">
            <Link
              to={campaign.bannerCtaUrl}
              style={{ backgroundColor: '#FFFFFF', color: '#122A1C', textDecoration: 'none' }}
              className="inline-flex min-h-9 w-auto shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-sm transition duration-150 hover:bg-[#EAF1E9] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/50 active:scale-[0.99] sm:min-h-10 sm:px-4 sm:text-sm"
            >
              {campaign.bannerCtaLabel}<ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to={campaign.termsUrl} className="whitespace-nowrap rounded py-1 text-xs font-medium text-white/85 underline decoration-white/40 underline-offset-4 transition-colors hover:text-white hover:decoration-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#122A1C] sm:text-sm">{campaign.termsLabel}</Link>
          </div>
        </div>
      </section>

      <Dialog.Root open={open} onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
        else closePopup(closeMethod.current ?? 'backdrop');
      }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-1000 bg-[#0B1710]/65 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in" />
          <Dialog.Content
            aria-describedby="campaign-popup-copy"
            onEscapeKeyDown={() => { closeMethod.current = 'escape'; }}
            onPointerDownOutside={() => { closeMethod.current = 'backdrop'; }}
            className="fixed left-1/2 top-1/2 z-1001 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-2xl border border-[#d9e2d8] border-t-4 border-t-custom-green bg-[#f6f5ef] p-5 text-[#17261D] shadow-[0_24px_80px_rgba(5,18,10,0.35)] outline-none sm:p-7"
          >
            <button type="button" aria-label="Lukk kampanjevindu" onClick={() => closePopup('button')} className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-[#536258] transition-colors hover:bg-[#e7e9e1] hover:text-[#17261D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-custom-green/50">
              <X size={19} />
            </button>
            <div className="flex items-center gap-3 pr-10">
              <div className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-[#dce9dc] text-custom-green">
                <Gift size={21} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[0.6875rem] font-semibold uppercase text-custom-green">SafePay-kampanje</p>
                <Dialog.Title className="mt-0.5 text-lg font-semibold leading-tight text-[#17261D] sm:text-xl">{campaign.name}</Dialog.Title>
              </div>
            </div>
            <Dialog.Description id="campaign-popup-copy" className="mt-3 max-w-prose text-[0.8125rem] leading-6 text-pretty text-[#4e5d52] sm:text-sm">{popupText}</Dialog.Description>
            <div className="mt-5 flex flex-col gap-3 border-t border-[#dce1d8] pt-4 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:pt-5">
              <Link to={campaign.popupCtaUrl} onClick={recordCtaClick} className="order-1 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-custom-green px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-[#245235] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-custom-green/20 sm:order-2 sm:w-auto">
                {campaign.popupCtaLabel}<ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to={campaign.termsUrl} className="order-2 self-center rounded py-1 text-sm font-medium text-custom-green underline decoration-custom-green/40 underline-offset-4 hover:decoration-custom-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-custom-green/40 sm:order-1 sm:self-auto">{campaign.termsLabel}</Link>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
