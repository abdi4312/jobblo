import { ShieldCheck } from 'lucide-react';
import { apiUrl } from '../../config/env';

/**
 * Vipps first, and in Vipps' own orange.
 *
 * Roughly four and a half million Norwegians have Vipps; for most of them it is the
 * fastest and most familiar way onto a service. It used to sit below Google, styled
 * identically to it in near-black, with the wordmark served as a 79 KB PNG. It is now
 * the primary action, in the brand colour Norwegians recognise instantly, with the
 * wordmark inlined as ~1 KB of vector that inherits `currentColor`.
 */
const VIPPS_WORDMARK_PATHS = [
  // "V"
  'M28 22l5.1 14.9 5-14.9H44l-8.8 22.1h-4.4L22 22z',
  // the smile
  'M57.3 40.6c3.7 0 5.8-1.8 7.8-4.4 1.1-1.4 2.5-1.7 3.5-.9 1 .8 1.1 2.3 0 3.7-2.9 3.8-6.6 6.1-11.3 6.1-5.1 0-9.6-2.8-12.7-7.7-.9-1.3-.7-2.7.3-3.4 1-.7 2.5-.4 3.4 1 2.2 3.3 5.2 5.6 9 5.6zm6.9-12.3c0 1.8-1.4 3-3 3s-3-1.2-3-3 1.4-3 3-3 3 1.3 3 3z',
  // "p"
  'M78.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8s-5.5 2.1-5.5 6.8z',
  // "p"
  'M104.3 22v3c1.5-2.1 3.8-3.6 7.2-3.6 4.3 0 9.3 3.6 9.3 11.3 0 8.1-4.8 12-9.8 12-2.6 0-5-1-6.8-3.5v10.6h-5.4V22zm0 11c0 4.5 2.6 6.9 5.5 6.9 2.8 0 5.6-2.2 5.6-6.9 0-4.6-2.8-6.8-5.6-6.8-2.9 0-5.5 2.1-5.5 6.8z',
  // "s"
  'M132.3 21.4c4.5 0 7.7 2.1 9.1 7.3l-4.9.8c-.1-2.6-1.7-3.5-4.1-3.5-1.8 0-3.2.8-3.2 2.1 0 1 .7 2 2.8 2.4l3.7.7c3.6.7 5.6 3.1 5.6 6.3 0 4.8-4.3 7.2-8.4 7.2-4.3 0-9.1-2.2-9.8-7.6l4.9-.8c.3 2.8 2 3.8 4.8 3.8 2.1 0 3.5-.8 3.5-2.1 0-1.2-.7-2.1-3-2.5l-3.4-.6c-3.6-.7-5.8-3.2-5.8-6.4.1-5 4.6-7.1 8.2-7.1z',
];

function VippsWordmark() {
  return (
    <svg
      viewBox="22 21 121 28"
      className="h-[1.15rem] w-auto"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {VIPPS_WORDMARK_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} />
      ))}
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-[18px]" aria-hidden="true" focusable="false">
      <path
        d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z"
        fill="#EA4335"
      />
      <path
        d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z"
        fill="#4285F4"
      />
      <path
        d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z"
        fill="#FBBC05"
      />
      <path
        d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z"
        fill="#34A853"
      />
    </svg>
  );
}

export default function SocialAuthButtons() {
  // Built by interpolating import.meta.env directly at one point, which produced
  // "undefined/api/auth/google" whenever the var was unset.
  const go = (path: string) => () => {
    window.location.href = apiUrl(path);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={go('/api/auth/vipps')}
        className="flex h-11.5 items-center justify-center gap-2.5 rounded-xl bg-[#FF5B24] px-4 text-[0.9375rem] font-semibold text-white transition duration-150 hover:bg-[#F04E17] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF5B24]/25 active:scale-[0.995]"
      >
        <span>Fortsett med</span>
        <VippsWordmark />
      </button>

      {/*
        BankID third, and quiet.

        Vipps is the fastest way onto the service for most Norwegians and stays the
        primary action; Google is the familiar fallback. BankID is neither — it is the
        heavyweight option, and someone reaching for it is doing so deliberately. Giving
        it a third filled button would flatten the hierarchy into a wall of equals, so
        it gets the same outline treatment as Google with the SafePay shield the product
        already uses to mean "verified", and sits last.

        `/api/auth/idura` with no `link` parameter is the sign-in intent. The server
        mints state, nonce and the PKCE verifier and holds them in the session — nothing
        about the flow is constructed here, which is precisely what was wrong before.
      */}
      <button
        type="button"
        onClick={go('/api/auth/idura')}
        className="flex h-11.5 items-center justify-center gap-2.5 rounded-xl border border-[#E6E7E1] bg-white px-4 text-[0.9375rem] font-semibold text-[#0B0B0B] transition duration-150 hover:border-[#D4D6CD] hover:bg-[#FAFBF7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 active:scale-[0.995]"
      >
        <ShieldCheck size={18} strokeWidth={2.2} className="text-[#2E6641]" />
        <span>Fortsett med BankID</span>
      </button>

      <button
        type="button"
        onClick={go('/api/auth/google')}
        className="flex h-11.5 items-center justify-center gap-2.5 rounded-xl border border-[#E6E7E1] bg-white px-4 text-[0.9375rem] font-semibold text-[#0B0B0B] transition duration-150 hover:border-[#D4D6CD] hover:bg-[#FAFBF7] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 active:scale-[0.995]"
      >
        <GoogleMark />
        <span>Fortsett med Google</span>
      </button>
    </div>
  );
}
