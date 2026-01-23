import React from "react";
import { MapPin, Clock, Trash2 } from "lucide-react";

interface ServiceCardProps {
  data: any;
  onDelete: () => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ data, onDelete }) => {
  const locationLabel =
    typeof data.location === "object"
      ? data.location.address || data.location.city || "Oslo"
      : data.location || "N/A";

  const displayPrice =
    typeof data.price === "object"
      ? `${data.price.value || 0}${data.price.unit || "kr"}`
      : `${data.price || 0} kr`;

  const displayDuration =
    typeof data.duration === "object"
      ? `${data.duration.value || "N/A"} ${data.duration.unit || ""}`
      : data.duration || "Fixed";

  const serviceImage =
    data.images && data.images.length > 0
      ? data.images[0]
      : data.image || "https://via.placeholder.com/500";

  return (
    <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-sm border border-gray-100 group flex flex-col h-full">
      <div className="relative h-52 overflow-hidden m-4 rounded-[2rem]">
        <img
          src={serviceImage}
          alt={data.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <button
          onClick={onDelete}
          className="absolute top-3 right-3 bg-white/90 text-red-500 p-2 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-lg z-10"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="p-6 pt-0 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-bold text-gray-800 line-clamp-1">
            {data.title || "Tjeneste"}
          </h3>
          <span className="bg-[#f6ad55] text-white text-[10px] font-black px-2 py-1 rounded-lg whitespace-nowrap">
            {displayPrice}
          </span>
        </div>
        <p className="text-gray-400 text-xs mb-6 line-clamp-2 font-medium">
          {data.description || "Ingen beskrivelse tilgjengelig"}
        </p>
        <div className="flex items-center gap-3 mb-6 mt-auto">
          <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <MapPin size={12} className="text-gray-400 shrink-0" />
            <span className="text-[10px] font-bold text-gray-500 truncate max-w-[80px]">
              {locationLabel}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
            <Clock size={12} className="text-gray-400 shrink-0" />
            <span className="text-[10px] font-bold text-gray-500">
              {displayDuration}
            </span>
          </div>
        </div>
        <button className="w-full bg-[#3e5a4d] text-white py-3 font-extrabold text-[12px] flex justify-center items-center !rounded-4xl hover:bg-[#2d4a3e] shadow-lg transition-all active:scale-95">
          Update Now
        </button>
      </div>
    </div>
  );
};

export default ServiceCard;
