import { useQuery } from '@tanstack/react-query';
import { fetchCampaignTerms } from '../api/campaigns';
import { CONTAINER } from '../theme/brand';

export default function CampaignTermsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-campaign-terms'],
    queryFn: fetchCampaignTerms,
    staleTime: 60_000,
  });

  return (
    <main className="min-h-[55vh] bg-[#EFF0EA] py-12 sm:py-16">
      <article className={`${CONTAINER} max-w-3xl`}>
        <p className="text-xs font-semibold uppercase tracking-wider text-custom-green">Jobblo SafePay</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#17261D] sm:text-4xl">Kampanjevilkår</h1>
        {isLoading ? (
          <div aria-label="Laster kampanjevilkår" className="mt-8 h-28 animate-pulse rounded-lg bg-white/70" />
        ) : isError || !data ? (
          <p role="alert" className="mt-8 border-l-2 border-red-700 bg-white px-4 py-3 text-sm text-gray-700">
            Kampanjevilkårene kunne ikke lastes. Last siden på nytt for å prøve igjen.
          </p>
        ) : (
          <div className="mt-8 border-t border-[#d4d9d0] pt-6">
            <h2 className="text-lg font-semibold text-[#17261D]">{data.name}</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-8 text-[#4e5d52]">{data.disclaimer}</p>
          </div>
        )}
      </article>
    </main>
  );
}
