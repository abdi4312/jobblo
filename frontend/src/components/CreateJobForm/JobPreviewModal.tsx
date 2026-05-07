import React from "react";
import { ChevronLeft, X } from "lucide-react";
import JobImageCarousel from "../job/JobImageCarousel";
import JobDetails from "../job/JobDetails";
import JobDescription from "../job/JobDescription";
import JobProvider from "../job/JobProvider";
import JobLocation from "../job/JobLocation";
import JobContainer from "../job/JobContainer";

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
  if (!showPreview) return null;

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

      <div className="max-w-300 mx-auto px-4 lg:px-0 pt-8 pb-20">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column */}
          <div className="flex-1 w-full min-w-0 space-y-5">
            <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
              <JobImageCarousel images={previewJobData.images} />
              <div className="px-6 pt-6 pb-8 sm:px-8 space-y-6">
                <JobDetails
                  job={{
                    title: previewJobData.title,
                    tags: previewJobData.tags,
                  }}
                />
                <div className="border-t border-[#F0F0F0]" />
                <JobDescription description={previewJobData.description} />
              </div>
            </div>

            <div className="bg-white rounded-[20px] p-6 sm:p-8 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
              <JobProvider job={previewJobData} />
            </div>

            <div className="bg-white rounded-[20px] p-3 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
              <JobLocation location={previewJobData.location} />
            </div>
          </div>

          {/* Right Column Sidebar */}
          <aside className="lg:w-90 w-full lg:sticky lg:top-20 space-y-4 shrink-0">
            <div className="bg-white rounded-[20px] overflow-hidden shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
              <div className="h-1.5 bg-custom-green" />
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-[11px] font-semibold text-custom-green uppercase tracking-widest mb-1">
                    Totalpris
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[42px] font-black text-custom-black leading-none tabular-nums">
                      {previewJobData.price.toLocaleString("nb-NO")}
                    </span>
                    <span className="text-[20px] font-semibold text-[#9CA3AF]">
                      kr
                    </span>
                  </div>
                </div>

                <button className="w-full py-4 bg-custom-green text-white rounded-2xl font-bold shadow-lg opacity-50 cursor-not-allowed">
                  Send melding (Preview)
                </button>

                <p className="text-[11px] text-center text-[#9CA3AF] leading-relaxed">
                  Trygt og sikkert oppgjør gjennom Jobblo.
                </p>
              </div>
            </div>

            <div className="bg-white rounded-[20px] p-6 shadow-[0px_2px_8px_0px_rgba(0,0,0,0.07)]">
              <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-widest mb-4">
                Oppdragsinfo
              </p>
              <JobContainer job={previewJobData} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
