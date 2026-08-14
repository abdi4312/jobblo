import { useNavigate } from 'react-router-dom';
import { MapPin, ShieldCheck } from 'lucide-react';
import { useJobs } from '../../features/jobsList/hooks';
import { dateFormatter } from '../../utils/dateFormatter';
import { jobImage } from '../../assets/images/categories';
import {
  CARD,
  CARD_INTERACTIVE,
  CONTAINER,
  HEADING,
  MICRO_LABEL,
  PILL_SECONDARY,
  SECTION,
} from '../../theme/brand';

type Job = {
  _id: string;
  title: string;
  description?: string;
  price?: number | string;
  promoted?: boolean;
  images?: string[];
  categories?: string[];
  createdAt?: string;
  location?: { city?: string; address?: string };
};

export function Jobs() {
  const navigate = useNavigate();
  const { data: jobsData, isLoading } = useJobs({ limit: 6, tab: 'Discover' });

  const jobs: Job[] = jobsData?.pages.flatMap((page) => page.data) ?? [];

  return (
    <section className={`${CONTAINER} ${SECTION}`}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className={MICRO_LABEL}>05 — Ute nå</p>
          <h2 className={`mt-4 ${HEADING}`}>
            Hvem trenger <span className="text-[#2E6641]">hjelp</span> nå?
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/search/job/all')}
          className={PILL_SECONDARY}
        >
          Se alle oppdrag
        </button>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${CARD} p-4`}>
                <div className="h-47.5 animate-pulse rounded-2xl bg-[#F0F1EB]" />
                <div className="mt-5 space-y-2.5 px-2">
                  <div className="h-5 w-3/4 animate-pulse rounded bg-[#F0F1EB]" />
                  <div className="h-3.5 w-1/2 animate-pulse rounded bg-[#F0F1EB]" />
                </div>
              </div>
            ))
          : jobs.slice(0, 6).map((job, i) => (
              <button
                key={job._id}
                type="button"
                onClick={() => navigate(`/job-listing/${job._id}`)}
                className={`${CARD_INTERACTIVE} flex cursor-pointer flex-col gap-5 p-4 pb-6 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15`}
              >
                <div className="h-47.5 overflow-hidden rounded-2xl bg-[#EAF1E9]">
                  <img
                    src={jobImage(job, i)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 px-2">
                  <span className="flex h-7 items-center gap-1.5 rounded-full bg-[#EAF1E9] px-3 text-[0.75rem] font-semibold text-[#2E6641]">
                    <ShieldCheck size={12} strokeWidth={2.4} />
                    SafePay
                  </span>
                  <span className="truncate text-[0.75rem] text-[#9B9E96]">
                    {job.promoted
                      ? 'Sponset'
                      : job.createdAt
                        ? dateFormatter.toRelative(job.createdAt)
                        : ''}
                  </span>
                </div>

                <h3 className="line-clamp-2 px-2 text-[1.25rem] font-semibold leading-tight tracking-[-0.03em] text-[#0B0B0B]">
                  {job.title}
                </h3>

                {job.description && (
                  <p className="line-clamp-2 px-2 text-[0.875rem] leading-relaxed text-[#63665F]">
                    {job.description}
                  </p>
                )}

                <div className="mx-2 mt-auto flex items-center justify-between gap-3 border-t border-[#E6E7E1] pt-5">
                  <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-[#63665F]">
                    <MapPin size={14} strokeWidth={1.9} className="shrink-0 text-[#9B9E96]" />
                    <span className="truncate">
                      {job.location?.city || job.location?.address || 'Norge'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[1.0625rem] font-bold tabular-nums tracking-[-0.02em] text-[#0B0B0B]">
                    {typeof job.price === 'number' ? job.price.toLocaleString('nb-NO') : job.price}{' '}
                    kr
                  </span>
                </div>
              </button>
            ))}
      </div>
    </section>
  );
}
