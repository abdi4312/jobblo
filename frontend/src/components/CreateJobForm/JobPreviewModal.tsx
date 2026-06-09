import React, { useState, lazy, Suspense } from "react";
import {
  ChevronLeft,
  X,
  MapPin,
  Star,
  Bookmark,
  Zap,
  Share2,
} from "lucide-react";
import { dateFormatter } from "../../utils/dateFormatter";
const MapComponent = lazy(() =>
  import("../component/map/MapComponent").then((module) => ({
    default: module.MapComponent,
  })),
);

interface JobPreviewModalProps {
  showPreview: boolean;
  setShowPreview: (show: boolean) => void;
  previewJobData: any;
}

export const JobPreviewModal: React.FC<JobPreviewModalProps> = ({
  showPreview,
  setShowPreview,
  previewJobData,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!showPreview) return null;

  const job = previewJobData;
  const [lng, lat] = job?.location?.coordinates || [10.7461, 59.9127];
  const hasCoordinates = true; // Preview usually shows a default location

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return dateFormatter.toShortDate(dateString);
    } catch {
      return "Akkurat nå";
    }
  };

  return (
    <div className="fixed inset-0 z-10000 bg-[#F5F6F8] overflow-y-auto animate-in fade-in duration-300">
      {/* Header Actions */}
      <div className="sticky top-0 z-10001 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setShowPreview(false)}
          className="flex items-center gap-2 text-gray-600 font-bold hover:bg-gray-100 px-4 py-2 rounded-xl transition-all"
        >
          <ChevronLeft size={20} />
          Lukk forhåndsvisning
        </button>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs font-bold text-gray-400 uppercase tracking-widest">
            Forhåndsvisning
          </span>
          <button
            title="Lukk forhåndsvisning"
            type="button"
            onClick={() => setShowPreview(false)}
            className="bg-custom-green text-white p-2 rounded-full hover:bg-[#25633e] transition-all shadow-lg"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Content (Replicating JobListingDetailPage UI) */}
      <div className="max-w-300 mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left - Image */}
          <div className="relative lg:sticky lg:top-20 lg:h-fit">
            <div className="rounded-xl overflow-hidden shadow-sm max-h-125 bg-white">
              {job.images && job.images.length > 0 ? (
                <img
                  src={job.images[selectedImageIndex]}
                  alt={job.title}
                  className="w-full max-h-125 h-full object-contain"
                />
              ) : (
                <div className="w-full h-96 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400">Ingen bilde</span>
                </div>
              )}

              {/* Badges */}
              <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                {job.promoted && (
                  <div className="bg-[#FF8A71] text-white px-4 py-2 rounded-full font-bold text-[12px] shadow-lg flex items-center gap-1.5 uppercase tracking-widest">
                    <Zap size={14} fill="white" /> Fremmet
                  </div>
                )}
                {job.urgent && (
                  <div className="bg-[#FF4B4B] text-white px-4 py-2 rounded-full font-bold text-[12px] shadow-lg flex items-center gap-1.5 uppercase tracking-widest">
                    <Zap size={14} fill="white" /> Haster
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {job.images && job.images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {job.images.slice(0, 4).map((img: string, idx: number) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImageIndex(idx)}
                    className={`w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-all ${idx === selectedImageIndex ? "ring-2 ring-[#2F7E47] opacity-100" : "opacity-70 hover:opacity-100"}`}
                  >
                    <img
                      src={img}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right - Details */}
          <div className="space-y-6">
            {/* Title & Price */}
            <div>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">
                    {job.title || "Uten tittel"}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    {job.tags && job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {job.tags.map((tag: string, index: number) => (
                          <span
                            key={index}
                            className="bg-custom-green/10 text-custom-green text-[12px] font-bold px-3 py-1 rounded-full border border-custom-green/10"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-sm font-bold text-custom-green bg-custom-green/5 px-3 py-1 rounded-full border border-[#2F7E47]/10">
                      <Bookmark size={14} fill="#2F7E47" color="#2F7E47" />
                      <span>0 lagret (Preview)</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-custom-green shrink-0">
                    {job.price ? job.price.toLocaleString() : "0"} kr
                  </p>
                  {job.hourlyRate > 0 && (
                    <p className="text-sm font-medium text-gray-500">
                      {job.hourlyRate.toLocaleString()} kr / time
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Varighet: {job.duration?.value || "-"}{" "}
                {job.duration?.unit || ""}
              </p>
            </div>

            {/* Preview Contact Button */}

            {/* Description */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Beskrivelse</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                {job.description || "Ingen beskrivelse tilgjengelig"}
              </p>
            </div>

            {/* Details */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-3">Detaljer</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Kategori</span>
                  <span className="font-medium">
                    {Array.isArray(job.tags)
                      ? job.tags[0]
                      : job.categories?.[0] || "Generelt"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Sted</span>
                  <span className="font-medium flex items-center gap-1">
                    <MapPin size={14} /> {job.location?.city || "Ikke angitt"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Lagt ut</span>
                  <span className="font-medium">
                    {formatDate(new Date().toISOString())}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Erfaring</span>
                  <span className="font-medium">
                    {job.experience || "Ikke angitt"}
                  </span>
                </div>
              </div>
            </div>

            {/* Map */}
            {hasCoordinates && (
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-3">
                  Kart over lokasjon
                </h2>
                <div className="h-48 rounded-lg overflow-hidden bg-gray-100">
                  <Suspense
                    fallback={
                      <div className="w-full h-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-400">
                        Laster kart...
                      </div>
                    }
                  >
                    <MapComponent coordinates={[lng, lat]} circleRadius={800} />
                  </Suspense>
                </div>
              </div>
            )}

            {/* Seller Info */}
            <div className="bg-white rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3">
                {job.userId?.avatarUrl ? (
                  <img
                    src={job.userId.avatarUrl}
                    alt={job.userId.name}
                    className="w-14 h-14 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-14 h-14 bg-custom-green rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {job.userId?.name?.charAt(0) || "?"}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">
                      {job.userId?.name || "Ditt navn"}
                    </p>
                    <span className="px-2 py-0.5 bg-gray-700 text-white text-xs rounded-full">
                      {job.userId?.verified ? "Verifisert" : "Ikke verifisert"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1 text-sm text-yellow-500">
                      <Star size={14} fill="currentColor" />
                      <span>{job.userId?.averageRating || "5.0"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-custom-green">
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Preview</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                <Share2 size={16} /> Del
              </button>
              <button className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 opacity-50 cursor-not-allowed">
                Rapporter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
