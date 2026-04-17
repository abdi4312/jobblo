import React, { useState, useMemo } from "react";
import { useCategories } from "../../features/categories/hooks";
import { Search, Info, Check, Sparkles, Loader2, X, Plus } from "lucide-react";
import type { CategoryType } from "../../features/categories/types";
import mainLink from "../../api/mainURLs";
import toast from "react-hot-toast";

interface BasicInformationProps {
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  price: string | number;
  setPrice: (val: string) => void;
  categories: string;
  setCategories: (val: string) => void;
  tags: string[];
  setTags: (val: string[]) => void;
  setDurationValue: (val: string) => void;
  setDurationUnit: (val: string) => void;
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
  tags,
  setTags,
  setDurationValue,
  setDurationUnit,
}) => {
  const { data: categoryData = [], isLoading, error } = useCategories();
  const [searchTerm, setSearchTerm] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [showTitleAiInput, setShowTitleAiInput] = useState(false);
  const [titleAiPrompt, setTitleAiPrompt] = useState("");
  const [newTag, setNewTag] = useState("");
  const maxDescriptionLength = 2000;

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleAiGenerate = async () => {
    if (!title || title.length < 5) {
      toast.error("Vennligst skriv en tittel først (min. 5 tegn)");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await mainLink.post("/api/ai/generate-job-info", {
        title,
        category: categories,
      });

      if (res.data?.success) {
        const {
          description: aiDesc,
          estimatedPrice,
          category: aiCategory,
          duration: aiDuration,
        } = res.data.data;
        setDescription(aiDesc);
        if (estimatedPrice && !price) {
          setPrice(estimatedPrice.toString());
        }
        if (aiCategory) {
          setCategories(aiCategory);
        }
        if (aiDuration && aiDuration.value) {
          setDurationValue(aiDuration.value.toString());
          setDurationUnit(aiDuration.unit || "hours");
        }
        toast.success("Beskrivelse generert med AI!");
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Kunne ikke generere AI-innhold. Sjekk API-nøkkel.";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTitle = async () => {
    if (!titleAiPrompt || titleAiPrompt.length < 5) {
      toast.error("Vennligst beskriv hva jobben går ut på (min. 5 tegn)");
      return;
    }

    setIsGeneratingTitle(true);
    try {
      const res = await mainLink.post("/api/ai/generate-title", {
        description: titleAiPrompt,
      });

      if (res.data?.success) {
        const { title: aiTitle, estimatedPrice } = res.data.data;
        setTitle(aiTitle);
        if (estimatedPrice) {
          setPrice(estimatedPrice.toString());
        }
        setShowTitleAiInput(false);
        setTitleAiPrompt("");
        toast.success("Tittel og pris generert!");
      }
    } catch (err: any) {
      console.error("TITLE GEN ERROR:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Kunne ikke generere tittel.";
      toast.error(errorMessage);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const filteredCategories = useMemo(() => {
    return categoryData.filter((cat: CategoryType | string) => {
      const catName = typeof cat === "string" ? cat : cat.name;
      return catName.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [categoryData, searchTerm]);

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. Title Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <label className="text-[11px] md:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            Tittel <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowTitleAiInput(!showTitleAiInput)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg
              text-[10px] md:text-xs font-bold hover:bg-purple-100 transition-all border border-purple-200"
            >
              <Sparkles size={12} />
              Generer med AI
            </button>
            <span
              className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full 
              ${title.length > 50 ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}
            >
              {title.length}/70
            </span>
          </div>
        </div>

        {showTitleAiInput && (
          <div className="mb-4 p-3 bg-purple-50/50 rounded-xl border border-purple-100 animate-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] font-bold text-purple-600 mb-2 uppercase tracking-tight">
              Hva skal gjøres?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={titleAiPrompt}
                onChange={(e) => setTitleAiPrompt(e.target.value)}
                placeholder="Beskriv jobben kort (f.eks. male en liten bod utvendig)"
                className="flex-1 px-3 py-2 text-xs md:text-sm rounded-lg border border-purple-200 focus:border-purple-400 outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleGenerateTitle()}
              />
              <button
                type="button"
                onClick={handleGenerateTitle}
                disabled={isGeneratingTitle}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold
              hover:bg-purple-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isGeneratingTitle ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "Generer"
                )}
              </button>
            </div>
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 70))}
          required
          placeholder="F.eks. Malearbeid i stue"
          className="w-full px-4 md:px-6 py-3 md:py-4 rounded-xl border border-gray-200
        bg-white text-base md:text-lg font-medium outline-none focus:border-[#2D7A4D]
         focus:ring-4 focus:ring-[#2D7A4D]/5 transition-all"
        />
      </div>

      {/* 2. Category Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <label className="text-[11px] md:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 mb-4">
          Velg kategori <span className="text-red-500">*</span>
        </label>

        <div className="relative mb-4 md:mb-6">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Søk i kategorier..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 md:pl-12 pr-4 md:pr-6 py-2 md:py-3 rounded-xl border border-gray-100 bg-white/80 text-xs md:text-sm outline-none focus:border-[#2D7A4D] transition-all"
          />
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 max-h-[250px] md:max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {isLoading ? (
            <div className="col-span-full py-10 flex flex-col items-center justify-center text-gray-400 italic">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D7A4D] mb-2" />
              Laster...
            </div>
          ) : error ? (
            <p className="col-span-full text-center py-6 text-red-500 text-sm">
              Kunne ikke laste kategorier
            </p>
          ) : filteredCategories.length === 0 ? (
            <p className="col-span-full text-center py-6 text-gray-400 text-sm">
              Ingen treff
            </p>
          ) : (
            filteredCategories.map((cat: CategoryType | string) => {
              const catName = typeof cat === "string" ? cat : cat.name;
              const isSelected = categories === catName;

              return (
                <button
                  key={catName}
                  type="button"
                  onClick={() => setCategories(catName)}
                  className={`
                                        relative group px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 
                                        border flex items-center justify-between
                                        ${
                                          isSelected
                                            ? "bg-[#2D7A4D] text-white border-[#2D7A4D] shadow-md scale-[1.02]"
                                            : "bg-white text-gray-600 border-gray-100 hover:border-[#2D7A4D] hover:bg-gray-50"
                                        }
                                    `}
                >
                  <span className="truncate">{catName}</span>
                  {isSelected && (
                    <Check size={14} className="shrink-0 ml-1 md:ml-2" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Description Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] md:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              Beskrivelse <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full w-fit">
              <Info size={10} />
              Min. 20 tegn
            </div>
          </div>

          {/* AI Generate Button */}
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600
            rounded-lg text-[10px] md:text-xs font-bold hover:bg-purple-100 transition-all border border-purple-200"
          >
            {isGenerating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {isGenerating ? "Genererer..." : "Generer med AI"}
          </button>
        </div>
        <div className="relative">
          <textarea
            value={description}
            onChange={(e) =>
              setDescription(e.target.value.slice(0, maxDescriptionLength))
            }
            required
            placeholder="Gi en detaljert beskrivelse..."
            className="min-h-[150px] md:min-h-[200px] w-full bg-white p-4 md:p-6 resize-none border
            border-gray-200 rounded-2xl outline-none focus:border-[#2D7A4D] focus:ring-4
          focus:ring-[#2D7A4D]/5 transition-all text-sm md:text-base text-gray-700 leading-relaxed"
          />
          <div className="absolute bottom-3 md:bottom-4 right-3 md:right-4 flex items-center gap-2">
            <span
              className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full ${description.length > maxDescriptionLength * 0.9 ? "bg-orange-100 text-orange-600" : "bg-gray-100 text-gray-500"}`}
            >
              {description.length}/{maxDescriptionLength}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Skills/Tags Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <label className="text-[11px] md:text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2 mb-4">
          Ferdigheter / Tags
        </label>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2D7A4D]/10 text-[#2D7A4D] rounded-full text-xs font-bold border border-[#2D7A4D]/20"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <p className="text-gray-400 text-xs italic py-2">
                Ingen ferdigheter lagt til ennå. Bruk AI for å generere eller
                legg til manuelt.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), handleAddTag())
                }
                placeholder="Legg til en ferdighet (f.eks. Maling, Vasking...)"
                className="w-full px-4 py-2 text-xs md:text-sm rounded-xl border border-gray-200 outline-none focus:border-[#2D7A4D] bg-white/50"
              />
            </div>
            <button
              type="button"
              onClick={handleAddTag}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
