import type { ReactNode } from 'react';
import AuthShowcase from './AuthShowcase';
import { MICRO_LABEL } from './authStyles';
import jobbloWordmark from '../../assets/images/Login/jobblo-wordmark.png';

/**
 * Shared shell for /login, /register and /forgot-password.
 *
 * All three pages carried their own copy of this markup *and* their own `<Toaster>` on
 * top of the global one in App.tsx, which is why every toast on an auth page appeared
 * twice — once at the top, once at the bottom. There is one Toaster now.
 *
 * The screen is sized to the viewport and does not scroll. `dvh` rather than `vh`
 * because on iOS Safari `vh` counts the URL bar, which pushed the submit button under
 * the browser chrome. The form column is the only scrollable region, and only becomes
 * one on viewports too short for its content.
 */
type AuthLayoutProps = {
  children: ReactNode;
};

/**
 * The full-colour wordmark — black type with the green sprout — rather than the
 * white-only artwork the old pages used.
 *
 * `self-start` matters: both places it appears are flex columns, and a bare <img> in one
 * is a flex item that stretches to the full cross-axis width. With the height pinned by
 * `h-8` that stretched the logo sideways, which is what wrecked its proportions. `w-auto`
 * alone does not prevent it — the stretch has to be opted out of.
 *
 * The asset is trimmed to the mark's own bounds, so it has no baked-in padding to throw
 * off alignment against neighbouring text.
 */
function Wordmark({ className = 'h-8' }: { className?: string }) {
  return (
    <img
      src={jobbloWordmark}
      alt="Jobblo"
      width={340}
      height={128}
      className={`w-auto shrink-0 self-start ${className}`}
    />
  );
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="h-dvh w-full overflow-hidden bg-[#EFF0EA] lg:p-2.5">
      <div className="grid h-full w-full overflow-hidden bg-white lg:grid-cols-[1.3fr_1fr] lg:rounded-[24px]">
        {/* ── Showcase panel ─────────────────────────────────────────────── */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#F4F6F0] px-12 py-11 xl:px-16 xl:py-14 lg:flex">
          <Wordmark />
          <AuthShowcase />
          <p className={MICRO_LABEL}>Trygg betaling · Vipps · Hele Norge</p>
        </aside>

        {/* ── Form column ────────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col bg-white">
          {/* On mobile the panel collapses to a slim bar so the form starts at the top. */}
          <div className="flex shrink-0 items-center border-b border-[#E6E7E1] px-6 py-4 lg:hidden">
            <Wordmark className="h-7" />
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
            <div className="w-full max-w-92">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
