import { useEffect, useState } from "react";

interface Category {
  title: string;
  description: string;
  image: string;
}

export function Info() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const data: Category[] = [
      {
        title: "Transport",
        description: "Flyttehjelp, varetransport og levering",
        image:
          "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800",
      },
      {
        title: "Renhold",
        description: "Hjemmerens, kontorrens og vinduspuss",
        image:
          "https://images.unsplash.com/photo-1581578731522-745d05cb9724?w=800",
      },
      {
        title: "Oppussing",
        description: "Maling, gulvlegging og renoveringer",
        image:
          "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800",
      },
      {
        title: "Rør og avløp",
        description: "Rørleggerarbeid og avløpsreparasjoner",
        image:
          "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800",
      },
      {
        title: "Hage og stell",
        description: "Gressklipping, hagearbeid og vedlikehold",
        image:
          "https://images.unsplash.com/photo-1416870213410-66fc17c85055?w=800",
      },
    ];

    setCategories(data);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="text-center py-20 text-gray-500">Laster inn...</div>;
  }

  return (
    <section className="bg-white">
    <div className="mx-auto px-4 py-15 font-sans max-w-7xl">
      <h2 className="text-3xl md:text-[40px] text-[#0A0A0A] font-bold text-center mb-10">
        Populære <span className="text-[#2F7E47]">kategorier</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categories.map((cat, index) => (
          <div
            key={index}
            className={`relative overflow-hidden rounded-2xl shadow-lg h-60 ${
              index === 2 ? "md:row-span-2 md:h-full" : ""
            }`}
          >
            <img
              src={cat.image}
              alt={cat.title}
              className="absolute inset-0 w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent" />

            <div className="absolute bottom-0 p-6 text-white">
              <h3 className="text-xl font-bold">{cat.title}</h3>
              <p className="text-sm opacity-80">{cat.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
    </section>
  );
}
