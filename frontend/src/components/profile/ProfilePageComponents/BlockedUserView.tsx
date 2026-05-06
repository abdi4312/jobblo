import React from "react";

export const BlockedUserView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 bg-[#f5f5f5] min-h-[500px]">
      <div className="bg-white p-12 rounded-[2.5rem] shadow-sm flex flex-col items-center text-center max-w-lg w-full">
        <div className="w-48 h-48 mb-8">
          <img
            src="https://api.builder.io/api/v1/image/assets/TEMP/c9959e70-6523-455a-9336-7936a798935c?apiKey=6d79042c16134a66804866657663e622&"
            alt="Blocked user"
            className="w-full h-full object-contain opacity-80"
          />
        </div>
        <h3 className="text-[22px] font-bold text-gray-900 mb-3">
          Du har blokkert denne brukeren
        </h3>
        <p className="text-[16px] text-gray-500 font-medium leading-relaxed">
          For å se denne brukerens annonser må du{" "}
          <button
            className="text-black font-bold underline hover:text-gray-700 transition-colors"
          >
            oppheve blokkeringen
          </button>{" "}
          først.
        </p>
      </div>
    </div>
  );
};
