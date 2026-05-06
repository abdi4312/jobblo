import {
  CreditCard,
  FileText,
  HelpCircle,
  Settings,
  Shield,
  User,
} from "lucide-react";

function CategoryCard() {
  const categories = [
    {
      icon: User,
      title: "Konto & Profil",
      color: "bg-[#2F7E471A] text-custom-green",
    },
    {
      icon: CreditCard,
      title: "Betaling",
      color: "bg-[#E088351A] text-[#E08835]",
    },
    {
      icon: FileText,
      title: "Oppdrag & Søknader",
      color: "bg-[#238CEB1A] text-[#238CEB]",
    },
    {
      icon: Shield,
      title: "Sikkerhet",
      color: "bg-[#2F7E471A] text-custom-green",
    },
    {
      icon: Settings,
      title: "Innstillinger",
      color: "bg-[#673AB71A] text-[#673AB7]",
    },
    {
      icon: HelpCircle,
      title: "Annet",
      color: "bg-[#9E9E9E1A] text-[#9E9E9E]",
    },
  ];
  return (
    <>
      <div className="bg-[#FFFFFF] overflow-hidden py-16">
        <div className="pb-12">
          <h1 className="text-custom-black text-[23px] sm:text-[28px] md:text-[32px] font-bold text-center">
            Velg en kategori
          </h1>
        </div>

        <div className="max-w-[1184px] mx-auto px-4">
          <div className="flex md:grid md:grid-cols-6 gap-6 overflow-x-auto pb-6 flex-nowrap md:flex-wrap scrollbar-hide">
            {categories.map((category, index) => (
              <div
                key={index}
                className={`
                        flex flex-col items-center justify-center gap-3 p-4 rounded-[16px] shadow-sm
                        min-w-[178px] max-w-[178px] h-[124px] shrink-0 
                        md:min-w-0 md:w-full md:shrink
                        ${category.color} cursor-pointer
                    `}
              >
                <category.icon size={28} />
                <span className="text-[14px] font-semibold text-center whitespace-nowrap md:whitespace-normal">
                  {category.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default CategoryCard;
