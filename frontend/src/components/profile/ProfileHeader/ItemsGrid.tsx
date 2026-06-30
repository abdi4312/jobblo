import { EmptyState } from './EmptyState';
import {
  Star,
  ChevronDown,
  Mail,
  Plus,
  Phone,
  Building,
  Globe,
  MapPin,
  Award,
  Briefcase,
  User,
  ShieldCheck,
  Pencil,
  Bookmark,
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
      <div className="max-w-300 mx-auto py-10 px-4 md:px-0 flex flex-col md:flex-row gap-12">
        {/* Left Side: Main Content */}
        <div className="flex-1 flex flex-col gap-12">
          {/* Services Section */}
          <section>
            <h3 className="text-[20px] font-bold text-gray-900 mb-4">Dette tilbyr vi</h3>
            {userSkills.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {userSkills.slice(0, 12).map((skill: string) => (
                  <span
                    key={skill}
                    className="px-5 py-2 box-card-custom rounded-lg text-[14px] font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    {skill}
                  </span>
                ))}
                {userSkills.length > 12 && (
                  <button className="text-[14px] font-bold text-custom-black hover:underline flex items-center gap-1 ml-2">
                    Vis alle ({userSkills.length}) <ChevronDown size={14} />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[14px] text-gray-600">Ingen tjenester lagt til ennå.</p>
            )}
          </section>

          {/* Locations Section */}
          <section>
            <h3 className="text-[20px] font-bold text-gray-900 mb-4">Her kan vi hjelpe deg</h3>
            {userLocations.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {userLocations.slice(0, 12).map((loc: string) => (
                  <span
                    key={loc}
                    className="px-5 py-2 bg-custom-green-light rounded-lg text-[14px] font-medium text-custom-black hover:bg-[#D1EDFB] transition-colors"
                  >
                    {loc}
                  </span>
                ))}
                {userLocations.length > 12 && (
                  <button className="text-[14px] font-bold text-custom-black hover:underline flex items-center gap-1 ml-2">
                    Vis alle ({userLocations.length}) <ChevronDown size={14} />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-[14px] text-gray-600">Ingen lokasjoner lagt til ennå.</p>
            )}
          </section>

          <div className="h-px bg-gray-200" />

          {/* About Us Section */}
          <section>
            <h2 className="text-[32px] font-bold text-gray-900 mb-6">Om oss</h2>
            <div className="flex flex-col gap-6 text-[16px] text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
              {user?.bio ? (
                <p>{user.bio}</p>
              ) : (
                <p className="text-[14px] text-gray-600">Ingen beskrivelse lagt til ennå.</p>
              )}
            </div>
          </section>
        </div>

        {/* Right Side: Sidebar */}
        <div className="w-full md:w-95 flex flex-col gap-8">
          {/* Contact Info */}
          <div className="flex flex-col gap-6 p-4 box-card-custom">
            <h3 className="text-[20px] font-bold text-custom-black text-center mb-2">
              Kontaktinformasjon
            </h3>
            <div className="flex flex-col gap-2">
              {user?.phone && (
                <div className="flex items-center gap-4 text-gray-600 group">
                  <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Phone size={22} />
                  </div>
                  <span className="font-bold text-[15px]">{user.phone}</span>
                </div>
              )}
              {user?.email && (
                <div className="flex items-center gap-4 text-gray-600 group">
                  <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Mail size={22} />
                  </div>
                  <span className="font-bold text-[15px]">{user.email}</span>
                </div>
              )}
              {user?.postSted && (
                <div className="flex items-center gap-4 text-gray-600 group">
                  <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <MapPin size={22} />
                  </div>
                  <span className="font-bold text-[15px]">{user.postSted}</span>
                </div>
              )}
              {user?.orgNumber && (
                <div className="flex items-center gap-4 text-gray-600 group">
                  <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Award size={22} />
                  </div>
                  <span className="font-bold text-[15px]">Org.nummer: {user.orgNumber}</span>
                </div>
              )}
              {user?.orgType && (
                <div className="flex items-center gap-4 text-gray-600 group">
                  <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Building size={22} />
                  </div>
                  <span className="font-bold text-[15px]">Organisasjonstype: {user.orgType}</span>
                </div>
              )}
              {user?.website && (
                <a
                  href={user.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 text-gray-600 hover:text-gray-900 transition-colors group"
                >
                  <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                    <Globe size={22} />
                  </div>
                  <span className="font-bold text-[15px]">Besøk nettsiden</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Seeker Specific Content
  if (profileType === 'seeker') {
    if (activeTab === 'Om meg') {
      const userSkills = (user as any)?.skills || [
        'Maling',
        'Snekkering',
        'Hagearbeid',
        'Rengjøring',
        'Flytting',
      ];
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4">
          <div className="flex flex-col gap-3.5">
            {/* Bio Card */}
            <div className="bg-white border border-black/5 rounded-[14px] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-[14px] font-medium text-custom-black flex items-center gap-1.5">
                  <User size={16} className="text-custom-green" /> Om meg
                </h3>
                {isOwner && (
                  <button
                    onClick={() => navigate('/settings/bio')}
                    className="text-[12px] text-custom-green flex items-center gap-1 hover:underline"
                  >
                    <Pencil size={12} /> Rediger
                  </button>
                )}
              </div>
              <p className="text-[13px] text-black/60 leading-relaxed">
                {user?.bio || 'Ingen beskrivelse lagt til ennå.'}
              </p>
            </div>

            {/* Skills Card */}
            <div className="bg-white border border-black/5 rounded-[14px] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-[14px] font-medium text-custom-black flex items-center gap-1.5">
                  <Plus size={16} className="text-custom-green" /> Mine ferdigheter
                </h3>
                {isOwner && (
                  <button
                    onClick={() => navigate('/settings/seeker')}
                    className="text-[12px] text-custom-green flex items-center gap-1 hover:underline"
                  >
                    <Plus size={12} /> Legg til
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {userSkills.map((skill: string) => (
                  <span
                    key={skill}
                    className="bg-[#f0faf0] text-[#166534] border border-[#c6f0d8] rounded-full px-3 py-1 text-[12px]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Availability Card */}
            <div className="bg-white border border-black/5 rounded-[14px] p-5">
              <div className="flex items-center justify-between mb-3.5">
                <h3 className="text-[14px] font-medium text-custom-black flex items-center gap-1.5">
                  <Plus size={16} className="text-custom-green" /> Tilgjengelighet denne uken
                </h3>
                {isOwner && (
                  <button
                    onClick={() => navigate('/settings/seeker')}
                    className="text-[12px] text-custom-green flex items-center gap-1 hover:underline"
                  >
                    <Pencil size={12} /> Rediger
                  </button>
                )}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {availability.map((day) => (
                  <div
                    key={day.name}
                    className={`rounded-lg p-2 text-center text-[11px] border ${day.on ? 'bg-[#f0faf0] text-[#166534] border-[#c6f0d8]' : 'bg-[#f9f9f7] text-black/20 border-[#f0ede6]'}`}
                  >
                    <div className="font-medium mb-0.5">{day.name}</div>
                    <div
                      className={`w-1.5 h-1.5 rounded-full mx-auto ${day.on ? 'bg-custom-green' : 'bg-black/10'}`}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3.5">
            {/* Rating Sidebar Card */}
            <div className="bg-white border border-black/5 rounded-[14px] p-4.5">
              <h3 className="text-[13px] font-medium text-custom-black flex items-center gap-1.5 mb-3.5">
                <Star size={15} className="text-custom-green" /> Din rating
              </h3>
              <div className="flex items-center gap-3.5 mb-3">
                <div className="text-[40px] font-medium text-custom-black leading-none">
                  {user?.averageRating?.toFixed(1) || '5.0'}
                </div>
                <div>
                  <div className="text-[#ca8a04] text-[16px] mb-0.5">★★★★★</div>
                  <div className="text-[11px] text-black/30">
                    {user?.reviewCount || 0} vurderinger
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {[5, 4, 3, 2, 1].map((s) => (
                  <div key={s} className="flex items-center gap-2 text-[11px] text-black/30">
                    <span className="w-4">{s}★</span>
                    <div className="flex-1 h-1 bg-[#f0ede6] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#ca8a04]"
                        style={{ width: s === 5 ? '100%' : '0%' }}
                      ></div>
                    </div>
                    <span className="w-4 text-right">{s === 5 ? user?.reviewCount || 0 : 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* SafePay History Card */}
            {isOwner && (
              <div
                className="bg-white border border-black/5 rounded-[14px] p-4.5 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => navigate('/settings/safepay')}
              >
                <h3 className="text-[13px] font-medium text-custom-black flex items-center gap-1.5 mb-3.5 text-left">
                  <ShieldCheck size={15} className="text-custom-green" /> SafePay-historikk
                </h3>
                <div className="py-2">
                  <strong className="block text-[28px] font-medium text-custom-green">
                    {(user as any)?.totalEarned || 0} kr
                  </strong>
                  <span className="text-[11px] text-black/40">Utbetalt via SafePay</span>
                </div>
                <p className="text-[11px] text-black/30 mt-2 leading-relaxed">
                  Alle utbetalinger er gjort trygt gjennom SafePay — ingen kontantoppgjør.
                </p>
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
      return (
        <EmptyState
          title="Ingen portfolio-elementer ennå"
          description="Denne brukeren har ikke lagt til noe i sin portfolio"
        />
      );
    }

    return (
      <div className="max-w-300 mx-auto p-6 flex flex-col gap-12">
        {portfolioItems.length > 0 && (
          <section>
            <h3 className="text-2xl font-bold mb-6">Portfolio</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              {portfolioItems.map((project: any) => (
                <div
                  key={project._id || project.id}
                  className="group relative aspect-square bg-gray-100 rounded-[2rem] overflow-hidden border border-gray-100 cursor-pointer shadow-sm hover:shadow-md transition-all duration-300"
                >
                  <img
                    src={project.imageUrl || project.image}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                    <h4 className="text-white font-bold text-sm md:text-base">{project.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {previousProjects.length > 0 && (
          <section>
            <h3 className="text-2xl font-bold mb-6">Tidligere prosjekter</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {previousProjects.map((project: any) => (
                <div
                  key={project._id || project.id}
                  className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex gap-4"
                >
                  {project.imageUrl && (
                    <img
                      src={project.imageUrl}
                      className="w-24 h-24 rounded-xl object-cover"
                      alt=""
                    />
                  )}
                  <div>
                    <h4 className="font-bold text-lg">{project.title}</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-custom-green bg-custom-green/10 px-2 py-0.5 rounded-full">
                        {project.category}
                      </span>
                      <span className="text-xs text-gray-400">
                        {project.date ? new Date(project.date).getFullYear() : project.year}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">{project.description}</p>
                    {project.link && (
                      <a
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-blue-600 hover:underline mt-2 inline-block"
                      >
                        Se prosjektet
                      </a>
                    )}
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
      return (
        <EmptyState
          title="Ingen sertifiseringer ennå"
          description="Brukeren har ikke lagt til noen sertifiseringer eller fagbrev"
        />
      );
    }

    return (
      <div className="max-w-300 mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certifications.map((cert: any) => (
            <div
              key={cert._id || cert.id}
              className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-6"
            >
              <div className="w-16 h-16 bg-custom-green/10 rounded-2xl flex items-center justify-center text-custom-green">
                <Award size={32} />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-lg text-gray-900">{cert.title}</h4>
                <p className="text-sm text-gray-500">Utstedt av: {cert.issuedBy}</p>
                {cert.date && (
                  <p className="text-xs text-gray-400">
                    {new Date(cert.date).toLocaleDateString('no-NO', {
                      year: 'numeric',
                      month: 'long',
                    })}
                  </p>
                )}
              </div>
              {cert.url && (
                <a
                  href={cert.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-custom-green font-bold text-sm hover:underline"
                >
                  Vis bevis
                </a>
              )}
            </div>
          ))}
        </div>
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
      return (
        <EmptyState
          title={emptyStateContent.Vurderinger.title}
          description={emptyStateContent.Vurderinger.description}
        />
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayReviews.map((review: any) => (
          <div
            key={review._id || review.id}
            className="bg-white border border-black/5 p-5 rounded-[14px] flex flex-col gap-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden bg-[#c8d8c8] flex items-center justify-center text-[14px] font-medium text-[#1a3a1a]">
                  {review.reviewerId?.avatarUrl || review.avatar ? (
                    <img
                      src={review.reviewerId?.avatarUrl || review.avatar}
                      alt={review.reviewerId?.name || review.author}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (review.reviewerId?.name || review.author)?.[0] || 'U'
                  )}
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-custom-black">
                    {review.reviewerId?.name || review.author}
                  </h4>
                  <p className="text-[11px] text-black/30">
                    {review.createdAt
                      ? new Date(review.createdAt).toLocaleDateString('no-NO')
                      : review.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-[#f0faf0] px-2.5 py-1 rounded-full border border-[#c6f0d8]">
                <Star size={12} fill="#16a34a" className="text-custom-green" />
                <span className="text-[12px] font-medium text-custom-green">{review.rating}.0</span>
              </div>
            </div>
            <p className="text-[13px] text-black/60 leading-relaxed italic">"{review.comment}"</p>
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
    (activeTab === 'Oppdrag' ||
      activeTab === 'Aktive' ||
      activeTab === 'Fullførte' ||
      activeTab === 'Tidligere') &&
    jobs.length > 0;

  if (showJobs) {
    const displayJobs =
      activeTab === 'Fullførte' || activeTab === 'Tidligere'
        ? jobs.filter((job) => job.status === 'completed' || job.status === 'closed')
        : jobs;

    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {displayJobs.map((job: Jobs) => (
          <div
            key={job._id}
            className="flex flex-col cursor-pointer group"
            onClick={() => navigate(`/job-listing/${job._id}`)}
          >
            {/* Image Container */}
            <div className="relative aspect-[4/5] rounded-[20px] overflow-hidden bg-white mb-3 shadow-sm border border-black/5">
              {job.mediaUrl || (job as any).images?.[0] ? (
                <img
                  src={job.mediaUrl || (job as any).images?.[0]}
                  alt={job.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-[#f9f9f7] text-black/10">
                  <Briefcase size={40} strokeWidth={1} />
                </div>
              )}
              {/* Bookmark Icon */}
              <div className="absolute bottom-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border border-black/5 hover:scale-110 transition-transform">
                <Bookmark size={14} className="text-black/80" />
              </div>
            </div>

            {/* Info Container */}
            <div className="px-1">
              <h4 className="text-[14px] font-bold text-custom-black mb-0.5 truncate">
                {job.title}
              </h4>
              <div className="text-[14px] font-bold text-custom-black mb-1">{job.price} kr</div>
              <p className="text-[13px] text-black/40 truncate">
                {typeof job.location === 'object'
                  ? job.location.city || job.location.address
                  : job.location || 'Oslo'}
              </p>
            </div>
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
