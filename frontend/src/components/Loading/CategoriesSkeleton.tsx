import { Spinner } from "../Ui/Spinner";

export const CategoriesSkeleton = () => (
    <div className="min-w-42 min-h-34.75 p-6 flex items-center justify-center rounded-xl bg-white border border-gray-100">
        <Spinner size={200} />
    </div>
);