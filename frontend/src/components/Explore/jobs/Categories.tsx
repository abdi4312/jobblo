import { Category } from "../../../components/component/Categories/Category.tsx";

export function Categories() {
  return (
    <>
      <div className="">
        <div className="max-w-262.5 mx-auto my-8">
          <h2 className="text-2xl md:text-3xl font-bold text-[#0A0A0A] tracking-tight">
            Categories
          </h2>
          <p className="text-gray-500 mt-2 text-[15px]">
            Find your next opportunity from our latest listings
          </p>
        </div>
        <Category />
      </div>
    </>
  );
}
