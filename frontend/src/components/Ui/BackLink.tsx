import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * The back affordance for interior pages.
 *
 * Deliberately not a button. A filled or outlined control competes with the page's real
 * actions and, sitting above the title, reads as the first thing you are meant to press —
 * which is the opposite of true. This is a quiet link that only gains weight on hover.
 *
 * `navigate(-1)` alone strands anyone who arrived by pasting a URL or following a link
 * from outside, since there is nothing in the history to go back to. `fallback` is where
 * those people land instead.
 */
export function BackLink({
  label = 'Tilbake',
  fallback = '/home',
  className = '',
}: {
  label?: string;
  /** Where to go when this tab has no history of its own. */
  fallback?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  const goBack = () => {
    // A fresh tab has one entry — this page. Anything more means there is a real previous
    // page to return to.
    if (window.history.length > 1) navigate(-1);
    else navigate(fallback);
  };

  return (
    <button
      type="button"
      onClick={goBack}
      className={`group -ml-1 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-[0.875rem] font-medium text-[#63665F] transition-colors hover:text-[#0B0B0B] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15 ${className}`}
    >
      <ArrowLeft
        size={15}
        strokeWidth={2.2}
        className="transition-transform duration-200 group-hover:-translate-x-0.5 motion-reduce:transition-none"
      />
      {label}
    </button>
  );
}

export default BackLink;
