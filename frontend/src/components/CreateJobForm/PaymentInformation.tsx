import React from "react";
import {
  Banknote,
  AlertCircle,
  CreditCard,
  Wallet,
  Clock,
  Info,
  Lock,
} from "lucide-react";
import toast from "react-hot-toast";

interface PaymentInformationProps {
  paymentType: string;
  setPaymentType: (val: string) => void;
  price: string | number;
  setPrice: (val: string) => void;
  hourlyRate: string | number;
  setHourlyRate: (val: string) => void;
  urgent: boolean;
  setUrgent: (val: boolean) => void;
  subscription?: string;
}

export const PaymentInformation: React.FC<PaymentInformationProps> = ({
  paymentType,
  setPaymentType,
  price,
  setPrice,
  hourlyRate,
  setHourlyRate,
  urgent,
  setUrgent,
  subscription = "Standard",
}) => {
  const isPaidSubscriber = subscription !== "Standard";

  const paymentMethods = [
    {
      id: "Fastpris",
      label: "Fastpris",
      icon: <Banknote size={20} />,
      desc: "Bli enig om en fast sum",
    },
    {
      id: "Timepris",
      label: "Timepris",
      icon: <Clock size={20} />,
      desc: "Betal per time brukt",
    },
    {
      id: "Anbud",
      label: "Anbud",
      icon: <CreditCard size={20} />,
      desc: "Motta tilbud fra flere",
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
      {/* 1. Payment Type Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#2D7A4D]/10 rounded-full flex items-center justify-center text-[#2D7A4D] shrink-0">
            <Wallet size={22} />
          </div>
          <div>
            <h2 className="font-bold text-lg md:text-xl text-[#0A0A0A]">
              Betalingsmetode
            </h2>
            <p className="text-gray-500 text-xs md:text-sm">
              Hvordan ønsker du å betale?
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
          {paymentMethods.map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setPaymentType(method.id)}
              className={`p-3 md:p-4 rounded-2xl border-2 text-left transition-all duration-300 ${
                paymentType === method.id
                  ? "border-[#2D7A4D] bg-[#2D7A4D]/5 shadow-md"
                  : "border-gray-100 bg-white hover:border-gray-200"
              }`}
            >
              <div
                className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center mb-2 md:mb-3 ${
                  paymentType === method.id
                    ? "bg-[#2D7A4D] text-white"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {method.id === "Fastpris" ? (
                  <Banknote size={18} />
                ) : method.id === "Timepris" ? (
                  <Clock size={18} />
                ) : (
                  <CreditCard size={18} />
                )}
              </div>
              <p
                className={`text-sm md:text-base font-bold ${paymentType === method.id ? "text-[#2D7A4D]" : "text-gray-700"}`}
              >
                {method.label}
              </p>
              <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 md:mt-1">
                {method.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Price Section */}
      <div className="bg-white/60 p-4 md:p-6 rounded-2xl border border-white/40 shadow-sm">
        <div className="flex items-center justify-between mb-4 md:mb-6">
          <label className="text-[11px] md:text-sm font-bold text-gray-700 uppercase tracking-wider">
            {paymentType === "Timepris"
              ? "Timepris (NOK)"
              : "Antatt budsjett (NOK)"}
          </label>
          <span className="text-[9px] md:text-xs font-bold text-[#2D7A4D] bg-[#2D7A4D]/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full uppercase">
            Valgfritt
          </span>
        </div>
        <div className="relative">
          <span className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm md:text-lg">
            NOK
          </span>
          <input
            type="number"
            value={paymentType === "Timepris" ? hourlyRate : price}
            onChange={(e) => {
              if (paymentType === "Timepris") {
                setHourlyRate(e.target.value);
              } else {
                setPrice(e.target.value);
              }
            }}
            placeholder="0"
            className="w-full pl-16 md:pl-20 pr-4 md:pr-6 py-3 md:py-4 rounded-xl border border-gray-200 bg-white text-lg md:text-xl font-bold text-[#0A0A0A] outline-none focus:border-[#2D7A4D] transition-all"
          />
        </div>
        {paymentType === "Timepris" && (
          <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-3">
            <Info size={16} className="text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700">
              Totalpris vil bli beregnet automatisk basert på antall timer:{" "}
              <strong>{price} NOK</strong>
            </p>
          </div>
        )}
      </div>

      {/* 3. Urgent Section */}
      <div
        className={`p-4 md:p-6 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between cursor-pointer relative ${
          !isPaidSubscriber
            ? "border-gray-100 bg-gray-50/50 grayscale opacity-80"
            : urgent
              ? "border-red-200 bg-red-50"
              : "border-gray-100 bg-white/60"
        }`}
        onClick={() => {
          if (!isPaidSubscriber) {
            toast.error(
              "Haster-valget er kun tilgjengelig for betalte abonnementer",
              {
                icon: "🔒",
              },
            );
            return;
          }
          setUrgent(!urgent);
        }}
      >
        {!isPaidSubscriber && (
          <div className="absolute top-2 right-4 flex items-center gap-1.5 bg-gray-900/10 px-2 py-0.5 rounded-full">
            <Lock size={10} className="text-gray-600" />
            <span className="text-[9px] font-bold text-gray-600 uppercase">
              PRO
            </span>
          </div>
        )}
        <div className="flex items-center gap-3 md:gap-4">
          <div
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${urgent && isPaidSubscriber ? "bg-red-500 text-white" : "bg-gray-100 text-gray-400"}`}
          >
            <AlertCircle size={20} className="md:w-6 md:h-6" />
          </div>
          <div>
            <p
              className={`text-sm md:text-base font-bold ${urgent && isPaidSubscriber ? "text-red-700" : "text-gray-700"}`}
            >
              Haster oppdraget?
            </p>
            <p className="text-[10px] md:text-sm text-gray-500">
              Gjør det mer synlig for potensielle hjelpere
            </p>
          </div>
        </div>
        <div
          className={`w-10 h-6 md:w-14 md:h-8 rounded-full p-1 transition-colors duration-300 shrink-0 ${urgent && isPaidSubscriber ? "bg-red-500" : "bg-gray-200"}`}
        >
          <div
            className={`w-4 h-4 md:w-6 md:h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 ${urgent && isPaidSubscriber ? "translate-x-4 md:translate-x-6" : "translate-x-0"}`}
          />
        </div>
      </div>
    </div>
  );
};
