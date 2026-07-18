import { EmptyState } from './EmptyState';
import {
  Star,
  Mail,
  Phone,
  Building,
  Globe,
  MapPin,
  Award,
  Briefcase,
  ShieldCheck,
  Pencil,
  Bookmark,
  Plus,
  User,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useUserProfile, useUserReviews } from '../../../features/profile/hooks';
import { useFavoriteLists } from '../../../features/favoriteLists/hooks';
import { JobDetailCardSkeleton } from '../../Loading/JobDetailCardSkeleton.tsx';
import { useNavigate } from 'react-router-dom';
import { useJobs } from '../../../features/jobsList/hooks';
import { JobCard } from '../../component/jobCard/JobCard.tsx';
import type { Jobs } from '../../../../types/Jobs.ts';
import { useUserStore } from '../../../stores/userStore.ts';
import { Button } from '../../Ui/Button.tsx';
import { useEffect, useRef } from 'react';

interface List {
  _id: string;
  name: string;
  services?: {
    images?: string[];
  }[];
}

export function ItemsGrid({
  activeTab,
  user,
  profileType,
}: {
  activeTab: string;
  user: any;
  profileType?: 'seeker' | 'poster';
}) {
  const navigate = useNavigate();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const currentUser = useUserStore((state) => state.user);
  const isOwner = user?._id === currentUser?._id;

  const { data: realReviews } = useUserReviews(user?._id, profileType);

  const {
    data: lists = [],
    isLoading: isListsLoading,
    isError: isListsError,
  } = useFavoriteLists(user?._id);

  const {
    data: jobsData,
    isLoading: isJobsLoading,
    isError: isJobsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useJobs({ userId: user?._id });

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || (activeTab !== 'Oppdrag' && activeTab !== 'Aktive'))
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, activeTab]);

  const jobs = (jobsData?.pages.flatMap((page) => page.data) || []) as unknown as Jobs[];

  // Company Portfolio View
  if (user?.role === 'company' && activeTab === 'Portfolio') {
    const userSkills = user?.skills || [];
    const userLocations = user?.locations || [];

    return (
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 sm:gap-5">
        {/* Left Side */}
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Services */}
          <section className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-black/5">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-2.5 sm:mb-3 uppercase tracking-wider">Tjenester</h3>
            {userSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {userSkills.map((skill: string) => (
                  <span key={skill} className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#f5f0e8] rounded-md text-[11px] sm:text-[12px] font-medium text-[#1a3a1a]">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] sm:text-[12px] text-black/30">Ingen tjenester lagt til.</p>
            )}
          </section>

          {/* Locations */}
          <section className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-black/5">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-2.5 sm:mb-3 uppercase tracking-wider">Lokasjoner</h3>
            {userLocations.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {userLocations.map((loc: string) => (
                  <span key={loc} className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#f5f0e8] rounded-md text-[11px] sm:text-[12px] font-medium text-[#1a3a1a] flex items-center gap-1 sm:gap-1.5">
                    <MapPin size={10} /> {loc}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] sm:text-[12px] text-black/30">Ingen lokasjoner lagt til.</p>
            )}
          </section>

          {/* About */}
          <section className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-black/5">
            <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-2.5 sm:mb-3 uppercase tracking-wider">Om oss</h3>
            <p className="text-[12px] sm:text-[13px] text-black/60 leading-relaxed">
              {user?.bio || 'Ingen beskrivelse lagt til.'}
            </p>
          </section>
        </div>

        {/* Right Side - Contact */}
        <div className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-black/5 h-fit">
          <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-3 sm:mb-4 uppercase tracking-wider">Kontakt</h3>
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {user?.phone && (
              <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-[12px] text-black/60">
                <Phone size={13} className="text-[#1a3a1a]" /> {user.phone}
              </div>
            )}
            {user?.email && (
              <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-[12px] text-black/60">
                <Mail size={13} className="text-[#1a3a1a]" /> <span className="truncate">{user.email}</span>
              </div>
            )}
            {user?.postSted && (
              <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-[12px] text-black/60">
                <MapPin size={13} className="text-[#1a3a1a]" /> {user.postSted}
              </div>
            )}
            {user?.orgNumber && (
              <div className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-[12px] text-black/60">
                <Award size={13} className="text-[#1a3a1a]" /> Org.nr: {user.orgNumber}
              </div>
            )}
            {user?.website && (
              <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 sm:gap-3 text-[11px] sm:text-[12px] text-[#1a3a1a] font-medium hover:underline">
                <Globe size={13} /> Besøk nettside
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Seeker Specific Content
  if (profileType === 'seeker') {
    if (activeTab === 'Om meg') {
      const userSkills = (user as any)?.skills || ['Maling', 'Snekkering', 'Hagearbeid', 'Rengjøring', 'Flytting'];
      const availability = [
        { name: 'Man', on: true },
        { name: 'Tir', on: false },
        { name: 'Ons', on: true },
        { name: 'Tor', on: false },
        { name: 'Fre', on: true },
        { name: 'Lør', on: true },
        { name: 'Søn', on: false },
      ];

      return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-4 sm:gap-5">
          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Bio */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-[12px] sm:text-[13px] font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 bg-[#1a3a1a] rounded-md flex items-center justify-center">
                    <User size={10} className="text-white sm:hidden" />
                    <User size={12} className="text-white hidden sm:block" />
                  </span>
                  Om meg
                </h3>
                {isOwner && (
                  <button onClick={() => navigate('/settings/bio')} className="text-[10px] sm:text-[11px] text-[#1a3a1a] font-semibold hover:underline flex items-center gap-1 bg-[#f5f0e8] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md">
                    <Pencil size={9} className="sm:hidden" /> <Pencil size={10} className="hidden sm:block" /> Rediger
                  </button>
                )}
              </div>
              <p className="text-[12px] sm:text-[13px] text-black/55 leading-[1.6] sm:leading-[1.7] pl-6 sm:pl-8">
                {user?.bio || 'Ingen beskrivelse lagt til.'}
              </p>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-[12px] sm:text-[13px] font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 bg-[#1a3a1a] rounded-md flex items-center justify-center">
                    <Briefcase size={10} className="text-white sm:hidden" />
                    <Briefcase size={12} className="text-white hidden sm:block" />
                  </span>
                  Ferdigheter
                </h3>
                {isOwner && (
                  <button onClick={() => navigate('/settings/seeker')} className="text-[10px] sm:text-[11px] text-[#1a3a1a] font-semibold hover:underline flex items-center gap-1 bg-[#f5f0e8] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md">
                    <Plus size={9} className="sm:hidden" /> <Plus size={10} className="hidden sm:block" /> Legg til
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 pl-6 sm:pl-8">
                {userSkills.map((skill: string) => (
                  <span key={skill} className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-[#f5f0e8] rounded-lg text-[11px] sm:text-[12px] font-semibold text-[#1a3a1a] border border-[#e8e0d0] hover:bg-[#ece5d8] transition-colors cursor-default">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Availability */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-black/5">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-[12px] sm:text-[13px] font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                  <span className="w-5 h-5 sm:w-6 sm:h-6 bg-[#1a3a1a] rounded-md flex items-center justify-center">
                    <Star size={10} className="text-white sm:hidden" />
                    <Star size={12} className="text-white hidden sm:block" />
                  </span>
                  Tilgjengelighet
                </h3>
                {isOwner && (
                  <button onClick={() => navigate('/settings/seeker')} className="text-[10px] sm:text-[11px] text-[#1a3a1a] font-semibold hover:underline flex items-center gap-1 bg-[#f5f0e8] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md">
                    <Pencil size={9} className="sm:hidden" /> <Pencil size={10} className="hidden sm:block" /> Rediger
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-2 pl-6 sm:pl-8">
                {availability.map((day) => (
                  <div key={day.name} className={`rounded-md sm:rounded-lg p-1.5 sm:p-2.5 text-center transition-all ${day.on ? 'bg-[#1a3a1a] text-white shadow-sm' : 'bg-black/5 text-black/25'}`}>
                    <div className="font-bold text-[8px] sm:text-[10px] uppercase tracking-wider mb-0.5 sm:mb-1">{day.name}</div>
                    <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full mx-auto ${day.on ? 'bg-white' : 'bg-black/10'}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:gap-4">
            {/* Rating */}
            <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-black/5">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-2.5 sm:mb-3 uppercase tracking-wider">Vurdering</h3>
              <div className="flex items-center gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                <div className="text-xl sm:text-2xl font-bold text-gray-900">{user?.averageRating != null ? user.averageRating.toFixed(1) : '0.0'}</div>
                <div>
                  <div className="text-amber-500 text-[11px] sm:text-xs">★★★★★</div>
                  <div className="text-[9px] sm:text-[10px] text-black/30">{user?.reviewCount || 0} vurderinger</div>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 sm:gap-1">
                {[5, 4, 3, 2, 1].map((s) => (
                  <div key={s} className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] text-black/30">
                    <span className="w-2.5 sm:w-3">{s}</span>
                    <div className="flex-1 h-1 bg-black/5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500" style={{ width: s === 5 ? '100%' : '0%' }} />
                    </div>
                    <span className="w-2.5 sm:w-3 text-right">{s === 5 ? user?.reviewCount || 0 : 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SafePay */}
            {isOwner && (
              <div className="bg-white rounded-xl p-3.5 sm:p-4 shadow-sm border border-black/5 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/settings/safepay')}>
                <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-2.5 sm:mb-3 uppercase tracking-wider">SafePay</h3>
                <div className="text-center">
                  <div className="text-lg sm:text-xl font-bold text-[#1a3a1a]">{(user as any)?.totalEarned || 0} kr</div>
                  <div className="text-[9px] sm:text-[10px] text-black/30 mt-0.5 sm:mt-1">Utbetalt via SafePay</div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  if (activeTab === 'Portfolio' && profileType === 'seeker') {
    const portfolioItems = (user as any)?.portfolio || [];
    const previousProjects = (user as any)?.previousProjects || [];

    if (portfolioItems.length === 0 && previousProjects.length === 0) {
      return <EmptyState title="Ingen portfolio" description="Denne brukeren har ikke lagt til noe i sin portfolio" />;
    }

    return (
      <div className="flex flex-col gap-5 sm:gap-6">
        {portfolioItems.length > 0 && (
          <section>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-3 sm:mb-4 uppercase tracking-wider">Portfolio</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3">
              {portfolioItems.map((project: any) => (
                <div key={project._id || project.id} className="group relative aspect-square bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-sm border border-black/5 cursor-pointer">
                  <img src={project.imageUrl || project.image} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 sm:p-3">
                    <h4 className="text-white font-medium text-[11px] sm:text-[12px]">{project.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {previousProjects.length > 0 && (
          <section>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-black/40 mb-3 sm:mb-4 uppercase tracking-wider">Tidligere prosjekter</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
              {previousProjects.map((project: any) => (
                <div key={project._id || project.id} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-black/5 flex gap-2.5 sm:gap-3">
                  {project.imageUrl && <img src={project.imageUrl} className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover shrink-0" alt="" />}
                  <div className="min-w-0">
                    <h4 className="font-semibold text-[12px] sm:text-[13px] text-gray-900 truncate">{project.title}</h4>
                    <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 mb-1 sm:mb-1.5">
                      <span className="text-[9px] sm:text-[10px] font-medium text-[#1a3a1a] bg-[#f5f0e8] px-1.5 sm:px-2 py-0.5 rounded">{project.category}</span>
                      <span className="text-[9px] sm:text-[10px] text-black/30">{project.date ? new Date(project.date).getFullYear() : project.year}</span>
                    </div>
                    <p className="text-[11px] sm:text-[12px] text-black/40 line-clamp-2">{project.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  if (activeTab === 'Sertifiseringer') {
    const certifications = (user as any)?.certifications || [];

    if (certifications.length === 0) {
      return <EmptyState title="Ingen sertifiseringer" description="Brukeren har ikke lagt til noen sertifiseringer" />;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        {certifications.map((cert: any) => (
          <div key={cert._id || cert.id} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-black/5 flex items-center gap-3 sm:gap-4">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#f5f0e8] rounded-lg flex items-center justify-center text-[#1a3a1a] shrink-0">
              <Award size={18} className="sm:hidden" />
              <Award size={20} className="hidden sm:block" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[12px] sm:text-[13px] text-gray-900 truncate">{cert.title}</h4>
              <p className="text-[10px] sm:text-[11px] text-black/40 truncate">{cert.issuedBy}</p>
              {cert.date && (
                <p className="text-[9px] sm:text-[10px] text-black/30 mt-0.5">
                  {new Date(cert.date).toLocaleDateString('no-NO', { year: 'numeric', month: 'short' })}
                </p>
              )}
            </div>
            {cert.url && (
              <a href={cert.url} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-[11px] text-[#1a3a1a] font-medium hover:underline shrink-0">
                Vis
              </a>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Poster Specific Content
  if (profileType === 'poster') {
    // Basic credibility signals
    if (activeTab === 'Aktive') {
      // Reuse jobs logic but filtered or as is
    }
  }

  // Common or fallback content
  const emptyStateContent: Record<string, { title: string; description: string }> = {
    Oppdrag: {
      title: 'Brukeren har ikke lagt ut noen oppdrag ennå',
      description: 'Når brukeren legger ut oppdrag, vil de vises her',
    },
    Aktive: {
      title: 'Ingen aktive oppdrag',
      description: 'Brukeren har ingen aktive oppdrag ute akkurat nå',
    },
    Fullførte: {
      title: 'Ingen fullførte oppdrag',
      description: 'Fullførte oppdrag vil vises her',
    },
    Vurderinger: {
      title: 'Ingen vurderinger ennå',
      description: 'Vurderinger fra tidligere arbeid vil vises her',
    },
    Lister: {
      title: 'Listene er for øyeblikket tomme',
      description: 'Lagrede elementer og samlinger vil vises her',
    },
  };

  const currentEmptyState = emptyStateContent[activeTab] || emptyStateContent['Oppdrag'];

  if (activeTab === 'Vurderinger') {
    const displayReviews = realReviews || [];

    if (displayReviews.length === 0) {
      return <EmptyState title="Ingen vurderinger" description="Vurderinger vil vises her" />;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3">
        {displayReviews.map((review: any) => (
          <div key={review._id || review.id} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm border border-black/5">
            <div className="flex items-center justify-between mb-2.5 sm:mb-3">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full overflow-hidden bg-[#c8d8c8] flex items-center justify-center text-[9px] sm:text-[10px] font-medium text-[#1a3a1a] shrink-0">
                  {review.reviewerId?.avatarUrl || review.avatar ? (
                    <img src={review.reviewerId?.avatarUrl || review.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (review.reviewerId?.name || review.author)?.[0] || 'U'
                  )}
                </div>
                <div className="min-w-0">
                  <h4 className="text-[11px] sm:text-[12px] font-medium text-gray-900 truncate">{review.reviewerId?.name || review.author}</h4>
                  <p className="text-[9px] sm:text-[10px] text-black/30">
                    {review.createdAt ? new Date(review.createdAt).toLocaleDateString('no-NO') : review.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-[11px] font-medium text-amber-600 shrink-0">
                <Star size={10} fill="currentColor" className="sm:hidden" /> <Star size={11} fill="currentColor" className="hidden sm:block" /> {review.rating}.0
              </div>
            </div>
            <p className="text-[11px] sm:text-[12px] text-black/50 leading-relaxed">"{review.comment}"</p>
            {review.serviceId?.title && (
              <div className="mt-2 pt-2 border-t border-black/5">
                <span className="text-[9px] sm:text-[10px] text-[#1a3a1a] bg-[#f0f5f0] px-2 py-0.5 rounded-full font-medium">
                  {review.serviceId.title}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (activeTab === 'Lister') {
    if (isListsLoading) return <JobDetailCardSkeleton />;
    if (isListsError)
      return <p className="text-center py-20 text-red-500">Kunne ikke laste lister.</p>;
  }

  if (['Oppdrag', 'Aktive', 'Fullførte', 'Tidligere'].includes(activeTab)) {
    if (isJobsLoading) return <JobDetailCardSkeleton />;
    if (isJobsError)
      return <p className="text-center py-20 text-red-500">Kunne ikke laste oppdrag.</p>;
  }

  const showJobs =
    (activeTab === 'Oppdrag' || activeTab === 'Aktive' || activeTab === 'Fullførte' || activeTab === 'Tidligere') &&
    jobs.length > 0;

  if (showJobs) {
    const displayJobs =
      activeTab === 'Fullførte' || activeTab === 'Tidligere'
        ? jobs.filter((job) => job.status === 'completed' || job.status === 'closed')
        : jobs;

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {displayJobs.map((job: Jobs) => (
          <div key={job._id} className="cursor-pointer group" onClick={() => navigate(`/job-listing/${job._id}`)}>
            <div className="relative aspect-[4/5] rounded-lg sm:rounded-xl overflow-hidden bg-white shadow-sm border border-black/5 mb-1.5 sm:mb-2">
              {job.mediaUrl || (job as any).images?.[0] ? (
                <img src={job.mediaUrl || (job as any).images?.[0]} alt={job.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#f5f0e8] text-black/10">
                  <Briefcase size={24} strokeWidth={1} className="sm:hidden" />
                  <Briefcase size={28} strokeWidth={1} className="hidden sm:block" />
                </div>
              )}
            </div>
            <h4 className="text-[11px] sm:text-[12px] font-medium text-gray-900 truncate">{job.title}</h4>
            <div className="text-[11px] sm:text-[12px] font-bold text-gray-900">{job.price} kr</div>
            <p className="text-[10px] sm:text-[11px] text-black/30 truncate">
              {typeof job.location === 'object' ? job.location.city || job.location.address : job.location || 'Oslo'}
            </p>
          </div>
        ))}
        {hasNextPage && <div ref={loadMoreRef} className="h-4 w-full" />}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <EmptyState title={currentEmptyState.title} description={currentEmptyState.description} />
    </div>
  );
}
