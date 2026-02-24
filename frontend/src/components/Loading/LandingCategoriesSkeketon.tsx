
export const LandingCategoriesSkeleton = () => {
  return (
    <section className="bg-white">
      <div className="mx-auto px-4 py-15 font-sans max-w-7xl">
        {/* Title Skeleton */}
        <div className="flex justify-center mb-10">
          <div className="h-10 bg-gray-200 rounded-lg w-64 animate-pulse"></div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(5)].map((_, index) => (
            <div
              key={index}
              className={`bg-gray-200 rounded-2xl animate-pulse h-60 ${
                index === 2 ? "md:row-span-2 md:h-full" : ""
              } flex flex-col justify-end p-6`}
            >
              {/* Text Placeholder inside skeleton */}
              <div className="h-6 bg-gray-300 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};