export const BannerSkeleton = () => {
  return (
    <div className="w-full max-w-300 mx-auto py-8 px-2 md:px-4 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between gap-3 md:gap-8">
        {/* Left Arrow Placeholder */}
        <div className="w-10 h-10 md:w-14 md:h-14 bg-gray-200 rounded-full shrink-0 hidden md:block border border-gray-100"></div>

        {/* Banner Card Placeholder */}
        <div className="flex-1 min-w-0 bg-white p-2 md:p-4 rounded-[30px] md:rounded-[48px] shadow-sm border border-gray-100 overflow-hidden relative h-95 md:h-125">
          <div className="w-full h-full rounded-[22px] md:rounded-[36px] bg-gray-100 relative overflow-hidden flex items-center">
            {/* Right Side Image Placeholder */}
            <div className="absolute top-0 bottom-0 right-[-2px] w-[80%] md:w-[70%] bg-gray-200">
              <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-100/50 to-transparent"></div>
            </div>

            {/* Left Side Content Placeholder */}
            <div className="relative z-20 pl-6 md:pl-16 w-full md:w-[70%] flex flex-col h-full justify-center">
              <div className="flex-1 flex flex-col justify-center space-y-4 md:space-y-6">
                {/* Title */}
                <div className="h-10 md:h-14 lg:h-20 bg-gray-200 rounded-xl w-3/4"></div>
                {/* Subtitle */}
                <div className="h-6 md:h-8 lg:h-10 bg-gray-200 rounded-lg w-1/2"></div>

                {/* Button */}
                <div className="h-12 md:h-16 bg-gray-200 rounded-xl md:rounded-[20px] w-40 mt-2"></div>
              </div>

              {/* Footer Text */}
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-6 md:mb-8"></div>
            </div>
          </div>
        </div>

        {/* Right Arrow Placeholder */}
        <div className="w-10 h-10 md:w-14 md:h-14 bg-gray-200 rounded-full shrink-0 hidden md:block border border-gray-100"></div>
      </div>
    </div>
  );
};
