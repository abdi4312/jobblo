import { Category } from "../component/Categories/Category";

export function Categories() {
  return (
    <section className="">
      <div className="mx-auto px-4 pt-8 font-sans max-w-7xl">
        <h2 className="text-3xl md:text-[40px] text-custom-black font-bold text-center mb-10">
          Populære <span className="text-custom-green">kategorier</span>
        </h2>

        {/* Exact same structure as Explore/jobs/Categories.tsx */}
        <Category />
      </div>
    </section>
  );
}
