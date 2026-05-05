import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";

interface JobImageCarouselProps {
  images?: string[];
}

const JobImageCarousel: React.FC<JobImageCarouselProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const jobImages =
    images && images.length > 0
      ? images
      : ["https://api.dicebear.com/7.x/avataaars/svg?seed=default"];

  const handlePrevious = () =>
    setCurrentIndex((prev) => (prev === 0 ? jobImages.length - 1 : prev - 1));

  const handleNext = () =>
    setCurrentIndex((prev) => (prev === jobImages.length - 1 ? 0 : prev + 1));

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrevious();
    }
  };

  return (
    <div
      className="relative w-full overflow-hidden group bg-gray-100 aspect-4/3 sm:aspect-16/8 md:aspect-16/7"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <img
        key={currentIndex}
        src={jobImages[currentIndex]}
        alt={`Bilde ${currentIndex + 1}`}
        className="w-full h-full object-contain"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* Prev button */}
      {jobImages.length > 1 && (
        <button
          onClick={handlePrevious}
          aria-label="Forrige bilde"
          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-2.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:text-custom-black hover:scale-110"
        >
          <ChevronLeft size={18} strokeWidth={2.5} />
        </button>
      )}

      {/* Next button */}
      {jobImages.length > 1 && (
        <button
          onClick={handleNext}
          aria-label="Neste bilde"
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-2.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-white hover:text-custom-black hover:scale-110"
        >
          <ChevronRight size={18} strokeWidth={2.5} />
        </button>
      )}

      {/* Dot indicators */}
      {jobImages.length > 1 && (
        <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-1.5 items-center">
          {jobImages.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Gå til bilde ${idx + 1}`}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex
                  ? "w-5 h-1.5 sm:w-6 sm:h-2 bg-custom-green"
                  : "w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/60 hover:bg-white"
              }`}
            />
          ))}
        </div>
      )}

      {/* Counter badge */}
      {jobImages.length > 1 && (
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10 px-2.5 py-0.5 rounded-full bg-black/35 backdrop-blur-sm text-[10px] sm:text-[11px] font-semibold text-white">
          {currentIndex + 1} / {jobImages.length}
        </div>
      )}
    </div>
  );
};

export default JobImageCarousel;
