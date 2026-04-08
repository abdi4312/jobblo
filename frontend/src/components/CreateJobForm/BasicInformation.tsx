import React from "react";
import { useCategories } from "../../features/categories/hooks";

interface BasicInformationProps {
    title: string;
    setTitle: (val: string) => void;
    description: string;
    setDescription: (val: string) => void;
    price: string | number;
    setPrice: (val: string) => void;
    categories: string;
    setCategories: (val: string) => void;
}

export const BasicInformation: React.FC<BasicInformationProps> = ({
    title,
    setTitle,
    description,
    setDescription,
    price,
    setPrice,
    categories,
    setCategories,
}) => {
    // FIXED: Hook se jo data aa raha hai uska naam 'categoryData' rakha hai taaki confusion na ho
    const { data: categoryData = [], isLoading, error } = useCategories();

    const inputClasses =
        "w-full px-4 py-[14px] rounded-[12px] border-2 border-[#e0e0e0] text-base outline-none focus:border-[#4CAF50] transition-all box-border";
    const labelClasses = "block mb-2 font-semibold text-[15px] text-[#2c3e50]";

    return (
        <div className="">
            <h2 className="text-[20px] font-bold leading-7 text-[#0A0A0A] py-6">Grunnleggende informasjon</h2>
            <div className="space-y-6">
                {/* 2. Tittel */}
                <div>
                    <p className="text-[14px] font-semibold text-[#0A0A0A] leading-5 pb-2">Tittel<span className="text-red-700"> *</span></p>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="F.eks. 'Trenger hjelp til gressklipping'"
                        className="w-full px-6 py-3 rounded-xl border border-[#0A0A0A1A] bg-[#FFFFFF] text-base outline-none focus:border-[#4CAF50] transition-all box-border"
                    />
                </div>

                <div className="mb-6">
                    <p className="text-[14px] font-semibold text-[#0A0A0A] leading-5 pb-2">Kategori <span className="text-red-700"> *</span></p>

                    <div className="bg-[#FFFFFFB2] p-6 rounded-[14px] shadow-md border border-[#eee]">
                        <div className="flex flex-wrap max-w-209 justify-center mx-auto gap-3">
                            {/* FIXED: categoryData use kiya hai jo hook se aa raha hai */}
                            {isLoading ? (
                                <p className="text-sm text-gray-500 italic">Laster kategorier...</p>
                            ) : error ? (
                                <p className="text-sm text-red-500">Kunne ikke laste kategorier</p>
                            ) : (
                                categoryData.map((cat: any) => {
                                    // Agar cat ek object hai (e.g. {name: 'Flytting'}), toh cat.name use karein
                                    const catName = typeof cat === 'string' ? cat : cat.name;
                                    const isSelected = categories === catName;

                                    return (
                                        <button
                                            key={catName}
                                            type="button"
                                            onClick={() => setCategories(catName)}
                                            className={`
                                                px-6 py-2 rounded-[14px] text-[14px] font-medium transition-all duration-200 
                                                border shadow-md
                                                ${isSelected
                                                    ? "bg-[#4CAF50] text-white border-[#4CAF50] scale-105"
                                                    : "bg-white text-[#364153] border-[#e0e0e0] hover:border-[#4CAF50] hover:text-[#4CAF50] hover:bg-[#f0f9f0]"
                                                }
                                            `}
                                        >
                                            {catName}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Beskrivelse */}
                <div>
                    <p className="text-[14px] font-semibold text-[#0A0A0A] leading-5 pb-2">Beskrivelse <span className="text-red-700"> *</span></p>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                        placeholder="Beskriv oppdraget i detalj..."
                        className={`min-h-[170px] w-full bg-[#FFFFFF] p-6 resize-y border rounded-[14px] border-[#0A0A0A1A] outline-none focus:border-[#4CAF50] transition-all box-border`}
                    />
                </div>

                {/* 4. Pris */}
                {/* <div>
                    <label className={labelClasses}>💰 Pris (NOK) *</label>
                    <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        required
                        placeholder="2000"
                        className={inputClasses}
                    />
                </div> */}
            </div>
        </div>
    );
};