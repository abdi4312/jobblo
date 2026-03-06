import React from "react";

interface PaymentInformationProps {
  paymentType: "Fastpris" | "Per time";
  setPaymentType: (val: "Fastpris" | "Per time") => void;
  price: string | number;
  setPrice: (val: string) => void;
  urgent: boolean;              // New prop
  setUrgent: (val: boolean) => void; // New prop
}

export const PaymentInformation: React.FC<PaymentInformationProps> = ({
  paymentType,
  setPaymentType,
  price,
  setPrice,
  urgent,
  setUrgent,
}) => {
  return (
    <div className="space-y-6">
      <h2 className="text-[20px] font-bold text-[#0A0A0A] mb-6">Betaling</h2>

      {/* Betaling Type Selection */}
      <div className="mb-5">
        <p className="text-[14px] font-semibold text-[#0A0A0A] leading-5 pb-2">Betaling Type <span className="text-red-700"> *</span></p>
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setPaymentType("Fastpris")}
            className={`flex-1 py-3 rounded-[12px] font-medium transition-all border-2 shadow-sm ${paymentType === "Fastpris"
              ? "bg-[#2D7A4D] text-white border-[#2D7A4D]"
              : "bg-white text-[#2D7A4D] border-[#2D7A4D] opacity-80"
              }`}
          >
            Fastpris
          </button>
          <button
            type="button"
            onClick={() => setPaymentType("Per time")}
            className={`flex-1 py-3 rounded-[12px] font-medium transition-all border-2 shadow-sm ${paymentType === "Per time"
              ? "bg-[#2D7A4D] text-white border-[#2D7A4D]"
              : "bg-white text-[#2D7A4D] border-[#2D7A4D] opacity-80"
              }`}
          >
            Per time
          </button>
        </div>
      </div>

      {/* Beløp Input */}
      <div className="flex flex-col md:flex-row gap-4 items-start mb-6">
        {/* Price Input Field */}
        <div className="flex-1 w-full">
          <p className="text-[14px] font-semibold text-[#0A0A0A] leading-5 pb-2">Beløp(NOK)<span className="text-red-700"> *</span></p>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-4 py-[14px] rounded-[14px] border border-[#0A0A0A1A] bg-[#FFFFFF] text-base outline-none focus:border-[#2D7A4D] transition-all"
          />
          <p className="mt-2 text-[12px] font-normal text-[#6A7282]">
            Angi total pris for hele oppdraget
          </p>
        </div>

        {/* Urgent Selection - Fixed Alignment */}
        <div
          className={`mt-[30px] p-[14px] rounded-[14px] flex-1 w-full border-2 transition-all cursor-pointer flex items-center gap-3 self-stretch md:self-auto ${urgent
            ? "bg-[#fff3cd] border-[#ffc107]"
            : "bg-white border-[#e0e0e0] hover:border-[#ffc107]"
            }`}
          onClick={() => setUrgent(!urgent)}
          style={{ minHeight: "54px" }} // Input height ke saath match karne ke liye
        >
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
            className="w-5 h-5 accent-[#ff9800] cursor-pointer"
            onClick={(e) => e.stopPropagation()} // Box click se conflict na ho
          />
          <span className={`font-semibold ${urgent ? "text-[#856404]" : "text-[#2c3e50]"}`}>
            ⚡ Haster det?
          </span>
        </div>
      </div>
    </div>
  );
};