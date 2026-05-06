import React from "react";
import { ExternalLink } from "lucide-react";
import { MapComponent } from "../component/map/MapComponent";

interface JobLocationProps {
  location?: {
    address?: string;
    city?: string;
    coordinates?: [number, number];
    radius?: number;
  };
}

const JobLocation: React.FC<JobLocationProps> = ({ location }) => {
  const [lng, lat] = location?.coordinates || [0, 0];
  const hasCoordinates =
    location?.coordinates &&
    location.coordinates.length === 2 &&
    (lng !== 0 || lat !== 0);

  // Logic to calculate radius based on coordinate precision if not provided by backend
  const calculateRadiusFromPrecision = (coordinate: number): number => {
    const str = coordinate.toString();
    const decimalPart = str.split(".")[1] || "";
    const precision = decimalPart.length;

    if (precision <= 2) return 5000; // ~5km for very low precision (e.g. 59.91)
    if (precision === 3) return 2000; // ~2km for medium-low precision (e.g. 59.913)
    if (precision === 4) return 800; // ~800m for medium precision (e.g. 59.9139)
    return 400; // ~400m for high precision
  };

  const radius =
    location?.radius ||
    (hasCoordinates ? calculateRadiusFromPrecision(lat) : 800);

  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${location?.address || ""} ${location?.city || ""}`.trim())}`;

  return (
    <div className="border border-amber-200 my-0 rounded-[14px] overflow-hidden">
      {/* Map Section */}
      {hasCoordinates && (
        <div className="w-full h-[250px] relative">
          <MapComponent
            coordinates={location!.coordinates!}
            circleRadius={radius}
          />
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 z-[1000] bg-white px-3 py-1.5 rounded-lg shadow-md flex items-center gap-2 text-[12px] font-medium text-[#101828] hover:bg-gray-50 transition-colors"
          >
            <ExternalLink size={14} />
            Åpne i Google Maps
          </a>
        </div>
      )}

      {/* <div className="flex flex-col justify-center items-center gap-3 py-6">
        <span className="pl-2.5 pt-3.25 pr-3.5 pb-2.75 text-custom-green! bg-[#CBDBD0]! rounded-full">
          <Navigation size={24} />
        </span>

        <div className="text-center">
          <h2 className="text-[20px] font-bold text-[#101828]">
            {location?.city || "Ingen by spesifisert"}
          </h2>
          <p className="text-[14px] font-normal text-[#4A5565]">
            {location?.address || "Området for oppdraget"}
          </p>
        </div>

        <div className="rounded-[14px] flex items-center justify-center gap-2 px-3 py-1.5 shadow-[0px_2px_4px_-2px_rgba(0,0,0,0.1)] bg-white">
          <span className="text-custom-green">
            <MapPin size={15} />
          </span>
          <p className="text-[#0A0A0A9E] text-[14px] font-light">
            Total radius: {radius}m
          </p>
        </div>
      </div> */}
    </div>
  );
};

export default JobLocation;
