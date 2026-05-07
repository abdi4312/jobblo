import { Spinner } from "../Ui/Spinner";

export const CategorySkeleton = () => {
  return (
    <div className="flex gap-2 max-w-282.5 mx-auto">
      {[...Array(8)].map((_, index) => (
        <div
          key={index}
          className="box-card-custom min-w-30.75 p-6.5 flex items-center animate-pulse"
        >
          <div className="flex flex-col gap-2 w-full py-2 items-center">
            <Spinner size={145} />
          </div>
        </div>
      ))}
    </div>
  );
};
