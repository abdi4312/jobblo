import { EmptyState } from "./EmptyState";
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
} from "lucide-react";
import { useParams } from "react-router-dom";
import {
  useUserProfile,
  useUserReviews,
} from "../../../features/profile/hooks";
import { useFavoriteLists } from "../../../features/favoriteLists/hooks";
import { JobDetailCardSkeleton } from "../../Loading/JobDetailCardSkeleton.tsx";
import { useNavigate } from "react-router-dom";
import { useJobs } from "../../../features/jobsList/hooks";
import { JobCard } from "../../component/jobCard/JobCard.tsx";
import type { Jobs } from "../../../../types/Jobs.ts";
import { useUserStore } from "../../../stores/userStore.ts";
import { Button } from "../../Ui/Button.tsx";
import { useEffect, useRef } from "react";

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
  profileType?: "seeker" | "poster";
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
    if (
      !hasNextPage ||
      isFetchingNextPage ||
      (activeTab !== "Oppdrag" && activeTab !== "Aktive")
    )
      return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, activeTab]);

  const jobs = (jobsData?.pages.flatMap((page) => page.data) ||
    []) as unknown as Jobs[];

  // Company Portfolio View
  if (user?.role === "company" && activeTab === "Portfolio") {
    const userSkills =
      user?.skills && user.skills.length > 0
        ? user.skills
        : [
            "Murer",
            "Murertjenester",
            "Gulvavretting",
            "Maler",
            "Gulvbelegg",
            "Snekker",
            "Gulvlegging",
            "Tregulv",
          ];
    const userLocations =
      user?.locations && user.locations.length > 0
        ? user.locations
        : [
            "Oslo",
            "Trondheim",
            "Steinkjer",
            "Namsos",
            "Frøya",
            "Osen",
            "Oppdal",
            "Rennebu",
          ];

    return (
      <div className="max-w-300 mx-auto py-10 px-4 md:px-0 flex flex-col md:flex-row gap-12">
        {/* Left Side: Main Content */}
        <div className="flex-1 flex flex-col gap-12">
          {/* Services Section */}
          <section>
            <h3 className="text-[20px] font-bold text-gray-900 mb-4">
              Dette tilbyr vi
            </h3>
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
          </section>

          {/* Locations Section */}
          <section>
            <h3 className="text-[20px] font-bold text-gray-900 mb-4">
              Her kan vi hjelpe deg
            </h3>
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
          </section>

          <div className="h-px bg-gray-200" />

          {/* About Us Section */}
          <section>
            <h2 className="text-[32px] font-bold text-gray-900 mb-6">Om oss</h2>
            <div className="flex flex-col gap-6 text-[16px] text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">
              {user?.bio || (
                <>
                  <p>
                    Vi er et nytt selskap her, men vi har mer enn 5 års
                    erfaring. Snekkere med lang erfaring i bygg aur
                    snekkerfaget, bruk oss for ditt oppdrag.
                  </p>
                  <div className="flex flex-col gap-3">
                    <p>Vi tilbyr deg:</p>
                    <ul className="list-none flex flex-col gap-2">
                      <li>
                        - snekkerarbeid (gips, maling, legging av gulv, vinduer
                        og dører, etc.)
                      </li>
                      <li>
                        - flyttetjenester (forsikring, pakking, transport)
                      </li>
                      <li>- renhold (flyttevask og byggvask)</li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Right Side: Sidebar */}
        <div className="w-full md:w-95 flex flex-col gap-8">
          {/* Action Box */}
          <div className=" box-card-custom p-8 rounded-2xl flex flex-col items-center text-center gap-6">
            <h4 className="text-[20px] font-bold text-gray-900">stoler</h4>
            <p className="text-[14px] text-gray-600 font-medium">
              Velg denne bedriften til å gjennomføre oppdraget ditt eller send
              en melding.
            </p>
            <div className="flex flex-col gap-3 w-full">
              <button className="w-full bg-[#1F093D] text-white py-3.5 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-[#2D0D58] transition-colors">
                <Plus size={18} /> Velg bedrift
              </button>
              <button className="w-full bg-white border border-[#1F093D] text-[#1F093D] py-3.5 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors">
                <Mail size={18} /> Send melding til bedriften
              </button>
            </div>
            <button className="text-[14px] font-bold text-[#0066A2] hover:underline flex items-center gap-1">
              <ChevronDown size={14} className="rotate-90" /> Tilbake til
              oppdraget
            </button>
          </div>

          {/* Contact Info */}
          <div className="flex flex-col gap-6 p-4 box-card-custom">
            <h3 className="text-[20px] font-bold text-custom-black text-center mb-2">
              Kontaktinformasjon
            </h3>
            <div className="flex flex-col gap-2">
              <button className="flex items-center gap-4 text-gray-600 hover:text-gray-900 transition-colors group">
                <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Phone size={22} />
                </div>
                <span className="font-bold text-[15px]">Vis telefonnummer</span>
              </button>
              <button className="flex items-center gap-4 text-gray-600 hover:text-gray-900 transition-colors group">
                <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Mail size={22} />
                </div>
                <span className="font-bold text-[15px]">Vis e-postadresse</span>
              </button>
              <div className="flex items-center gap-4 text-gray-600 group">
                <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <MapPin size={22} />
                </div>
                <span className="font-bold text-[15px]">
                  Sagmyrvegen 7, 7549 TANEM
                </span>
              </div>
              <div className="flex items-center gap-4 text-gray-600 group">
                <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Award size={22} />
                </div>
                <span className="font-bold text-[15px]">
                  Org.nummer: {user?.orgNumber || "930331481"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-gray-600 group">
                <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Building size={22} />
                </div>
                <span className="font-bold text-[15px]">
                  Organisasjonstype: Aksjeselskap
                </span>
              </div>
              <button className="flex items-center gap-4 text-gray-600 hover:text-gray-900 transition-colors group">
                <div className="p-2 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Globe size={22} />
                </div>
                <span className="font-bold text-[15px]">
                  Besøk bedriftens nettside
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Seeker Specific Content
  if (profileType === "seeker") {
    if (activeTab === "Om meg") {
      const userSkills = (user as any)?.skills || [
        "Maling",
        "Snekkering",
        "Hagearbeid",
        "Rengjøring",
        "Flytting",
      ];
      const availabilityText =
        (user as any)?.availabilityText ||
        "Mandag - Fredag: 08:00 - 16:00\nLørdag: 10:00 - 14:00\nSøndag: Stengt";

      return (
        <div className="max-w-300 mx-auto pt-5 flex flex-col gap-6">
          {/* Bio Section */}
          <div className="bg-white/60 p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white">
            <h3 className="text-xl font-bold mb-4">Om meg</h3>
            <p className="text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
              {user?.bio || "Ingen beskrivelse lagt til ennå."}
            </p>
          </div>

          {/* Experience Section */}
          <div className="bg-white/60 p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white">
            <h3 className="text-xl font-bold mb-6">Erfaring</h3>
            {Array.isArray((user as any)?.experience) &&
            (user as any).experience.length > 0 ? (
              <div className="flex flex-col gap-6">
                {(user as any).experience.map((exp: any, idx: number) => (
                  <div
                    key={exp._id || idx}
                    className={`flex flex-col gap-1 ${idx !== 0 ? "pt-6 border-t border-gray-100" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-gray-900">{exp.title}</h4>
                      <span className="text-xs font-bold text-custom-green bg-custom-green/10 px-3 py-1 rounded-full">
                        {new Date(exp.startDate).getFullYear()} -{" "}
                        {exp.endDate
                          ? new Date(exp.endDate).getFullYear()
                          : "Nåværende"}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-500">
                      {exp.company}
                    </p>
                    {exp.description && (
                      <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-700 leading-relaxed font-medium whitespace-pre-wrap">
                {typeof user?.experience === "string"
                  ? user.experience
                  : "Ingen erfaring lagt til ennå."}
              </p>
            )}
          </div>

          {/* Skills Section */}
          <div className="bg-white/60 p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white">
            <h3 className="text-xl font-bold mb-6">Mine ferdigheter</h3>
            <div className="flex flex-wrap gap-3">
              {userSkills.map((skill: string) => (
                <span
                  key={skill}
                  className="px-4 py-1 bg-[#2F7E4715] rounded-md text-sm font-bold text-custom-green border border-[#2F7E4720]"
                >
                  {skill}
                </span>
              ))}
              {userSkills.length === 0 && (
                <p className="text-gray-400">
                  Ingen ferdigheter lagt til ennå.
                </p>
              )}
            </div>
          </div>

          {/* Availability Section */}
          <div className="bg-white/60 p-8 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.04)] border border-white">
            <h3 className="text-xl font-bold mb-6">Min tilgjengelighet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availabilityText.split("\n").map((time: string) => (
                <div
                  key={time}
                  className="p-4 rounded-xl bg-[#2F7E4715] text-custom-green border border-[#2F7E4720] shadow-sm font-medium"
                >
                  {time}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  if (activeTab === "Portfolio" && profileType === "seeker") {
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
                    <h4 className="text-white font-bold text-sm md:text-base">
                      {project.title}
                    </h4>
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
                        {project.date
                          ? new Date(project.date).getFullYear()
                          : project.year}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-2">
                      {project.description}
                    </p>
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

  if (activeTab === "Sertifiseringer") {
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
                <h4 className="font-bold text-lg text-gray-900">
                  {cert.title}
                </h4>
                <p className="text-sm text-gray-500">
                  Utstedt av: {cert.issuedBy}
                </p>
                {cert.date && (
                  <p className="text-xs text-gray-400">
                    {new Date(cert.date).toLocaleDateString("no-NO", {
                      year: "numeric",
                      month: "long",
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
  if (profileType === "poster") {
    // Basic credibility signals
    if (activeTab === "Aktive") {
      // Reuse jobs logic but filtered or as is
    }
  }

  // Common or fallback content
  const emptyStateContent: Record<
    string,
    { title: string; description: string }
  > = {
    Oppdrag: {
      title: "Brukeren har ikke lagt ut noen oppdrag ennå",
      description: "Når brukeren legger ut oppdrag, vil de vises her",
    },
    Aktive: {
      title: "Ingen aktive oppdrag",
      description: "Brukeren har ingen aktive oppdrag ute akkurat nå",
    },
    Fullførte: {
      title: "Ingen fullførte oppdrag",
      description: "Fullførte oppdrag vil vises her",
    },
    Vurderinger: {
      title: "Ingen vurderinger ennå",
      description: "Vurderinger fra tidligere arbeid vil vises her",
    },
    Lister: {
      title: "Listene er for øyeblikket tomme",
      description: "Lagrede elementer og samlinger vil vises her",
    },
  };

  const currentEmptyState =
    emptyStateContent[activeTab] || emptyStateContent["Oppdrag"];

  if (activeTab === "Vurderinger") {
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
      <div className="max-w-300 mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayReviews.map((review: any) => (
            <div
              key={review._id || review.id}
              className="bg-white/60 p-6 rounded-xl border border-white shadow-sm flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100">
                    <img
                      src={review.reviewerId?.avatarUrl || review.avatar}
                      alt={review.reviewerId?.name || review.author}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">
                      {review.reviewerId?.name || review.author}
                    </h4>
                    <p className="text-xs text-gray-400 font-medium">
                      {review.createdAt
                        ? new Date(review.createdAt).toLocaleDateString("no-NO")
                        : review.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-[#2F7E4710] px-3 py-1.5 rounded-xl">
                  <Star
                    size={14}
                    fill="#2F7E47"
                    className="text-custom-green"
                  />
                  <span className="text-sm font-bold text-custom-green">
                    {review.rating}.0
                  </span>
                </div>
              </div>
              <p className="text-gray-600 leading-relaxed italic text-sm">
                "{review.comment}"
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === "Lister") {
    if (isListsLoading) return <JobDetailCardSkeleton />;
    if (isListsError)
      return (
        <p className="text-center py-20 text-red-500">
          Kunne ikke laste lister.
        </p>
      );
  }

  if (["Oppdrag", "Aktive", "Fullførte", "Tidligere"].includes(activeTab)) {
    if (isJobsLoading) return <JobDetailCardSkeleton />;
    if (isJobsError)
      return (
        <p className="text-center py-20 text-red-500">
          Kunne ikke laste oppdrag.
        </p>
      );
  }

  const showJobs =
    (activeTab === "Oppdrag" ||
      activeTab === "Aktive" ||
      activeTab === "Fullførte" ||
      activeTab === "Tidligere") &&
    jobs.length > 0;
  const showLists = activeTab === "Lister" && lists.length > 0;

  // For "Fullførte" and "Tidligere", we might want to filter jobs that are completed.
  // Assuming job status exists. If not, we just show all for now.
  const filteredJobs =
    activeTab === "Fullførte" || activeTab === "Tidligere"
      ? jobs.filter(
          (job) => job.status === "completed" || job.status === "closed",
        )
      : jobs;

  const displayJobs = filteredJobs.length > 0 ? filteredJobs : jobs; // Fallback to all if no filtered jobs for sample

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-300 mx-auto">
        {showLists ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {lists.map((list: List) => {
              const latestService = list.services?.[list.services.length - 1];
              const backgroundImage = latestService?.images?.[0] || "";

              return (
                <div
                  key={list._id}
                  onClick={() => navigate(`/favorites/list/${list._id}`)}
                  className="relative aspect-4/5 w-full rounded-3xl overflow-hidden cursor-pointer group shadow-sm"
                >
                  {backgroundImage ? (
                    <img
                      src={backgroundImage}
                      alt={list.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                      <span className="text-sm">Ingen bilder</span>
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

                  <div className="absolute bottom-6 left-6 right-6">
                    <h2 className="text-white font-bold text-lg md:text-xl drop-shadow-md truncate">
                      {list.name}
                    </h2>
                  </div>
                </div>
              );
            })}
          </div>
        ) : showJobs ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {displayJobs.map((job: Jobs) => (
                <JobCard key={job._id} job={job} isOwner={isOwner} />
              ))}
            </div>
            {hasNextPage && (
              <div
                ref={loadMoreRef}
                className="flex justify-center mt-10 min-h-[100px]"
              >
                {isFetchingNextPage ? (
                  <div className="flex items-center gap-2 bg-custom-green text-white px-8 py-2 rounded-full font-bold">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Laster mer...
                  </div>
                ) : (
                  <div className="h-4 w-full" />
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center">
            <EmptyState
              title={currentEmptyState.title}
              description={currentEmptyState.description}
            />
          </div>
        )}
      </div>
    </div>
  );
}
