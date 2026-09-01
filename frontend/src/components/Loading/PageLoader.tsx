/**
 * The full-screen loader, shown while a lazy route or the session resolves.
 *
 * It replaces a 382 KB Lottie of a tumbling hourglass that was rendered with no size
 * constraint, so it filled the viewport — a cartoon the height of the screen, on a
 * palette that shared nothing with the product, parsed and played on every cold route.
 *
 * What is here instead is the sprout from the wordmark and a hairline that sweeps. The
 * restraint is the point: a loading state should read as the product composing itself,
 * not as an interlude with its own personality. Nothing bounces, nothing changes colour,
 * and under `prefers-reduced-motion` the bar simply rests at a quarter width.
 *
 * Cost is zero bytes of payload — it is one inline SVG and two CSS keyframes.
 */
export function PageLoader({ label = 'Laster …' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-7 bg-[#EFF0EA] px-6"
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2E6641"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 21V11" />
        <path d="M12 11C12 7.7 9.5 5 6 5c0 3.3 2.5 6 6 6Z" />
        <path d="M12 11c0-3.3 2.5-6 6-6 0 3.3-2.5 6-6 6Z" />
      </svg>

      {/* The track is a hairline; the segment is 40 % of it and travels past both ends,
          so the motion has no visible beginning or end to snag the eye on. */}
      <div className="h-px w-40 overflow-hidden rounded-full bg-[#E6E7E1]">
        <div className="h-full w-2/5 rounded-full bg-[#2E6641] animate-[jb-progress_1.4s_ease-in-out_infinite] motion-reduce:animate-none" />
      </div>

      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-[#9B9E96]">
        {label}
      </span>
    </div>
  );
}

export default PageLoader;
