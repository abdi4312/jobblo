import { ChevronLeft, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';
import { InfinitySpin } from 'react-loader-spinner';

interface JobImageCarouselProps {
  images?: string[];
  loading?: boolean;
}

const JobImageCarousel: React.FC<JobImageCarouselProps> = ({ images, loading }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (loading) {
    return (
      <div className="relative w-full p-3">
        <div className="h-2 w-px"></div>
        <div className="relative w-full h-58.5 md:h-74.25 overflow-hidden rounded-t-lg bg-gray-200 animate-pulse flex items-center justify-center">
          <InfinitySpin width="150" color="#4fa94d" />
        </div>
      </div>
    );
  }

  const jobImages = images && images.length > 0
    ? images
    : ['https://api.dicebear.com/7.x/avataaars/svg?seed=default'];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? jobImages.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === jobImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className={`relative w-full overflow-visible p-3 ${loading ? 'opacity-50' : ''}`}>
      {/* Spacer div from your original code */}
      <div className="h-2 w-px"></div>

      <div className="relative w-full h-58.5 md:h-74.25 overflow-hidden rounded-t-lg">
        <img
          src={jobImages[currentIndex]}
          alt={`Job image ${currentIndex + 1}`}
          className="absolute top-0 left-0 w-full h-58.5 md:h-112.5 object-cover"
        />
      </div>

      {/* Navigation Dots */}
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10">
        <div
          className="min-w-16] h-4 bg-[rgba(251,236,213,0.9)] rounded-[50px] border-[0.2px] border-[var(--color-text)] flex items-center justify-center gap-2 px-2 py-1 transition-opacity"
          style={{ opacity: jobImages.length <= 1 ? 0.4 : 1 }}
        >
          {jobImages.map((_, index) => (
            <div
              key={index}
              onClick={() => jobImages.length > 1 && setCurrentIndex(index)}
              className={`w-[7px] h-[7px] rounded-full transition-all duration-300 
            ${index === currentIndex ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-fbe)]'}
            ${jobImages.length > 1 ? 'cursor-pointer' : 'cursor-default'}`}
            ></div>
          ))}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex justify-between px-1.25 pointer-events-none z-10 w-full">
        {/* Previous Button */}
        <button
          className="group pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-110 disabled:cursor-not-allowed"
          onClick={handlePrevious}
          disabled={jobImages.length <= 1}
        >
          <div
            className="p-1 bg-[#FFFFFF] rounded-full flex items-center justify-center shadow-md"
            style={{ opacity: jobImages.length <= 1 ? 0.4 : 1 }}
          >
            <ChevronLeft />
          </div>
        </button>

        {/* Next Button */}
        <button
          className="group pointer-events-auto cursor-pointer transition-transform duration-200 hover:scale-110 disabled:cursor-not-allowed"
          onClick={handleNext}
          disabled={jobImages.length <= 1}
        >
          <div
            className="p-1 bg-[#FFFFFF] rounded-full flex items-center justify-center shadow-md"
            style={{ opacity: jobImages.length <= 1 ? 0.4 : 1 }}
          >
            {/* <path d="M6 4L10 8L6 12" stroke="var(--color-icon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> */}
            <ChevronRight />
          </div>
        </button>
      </div>
    </div>
  );
};

export default JobImageCarousel;
