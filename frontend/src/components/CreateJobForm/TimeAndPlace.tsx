import { CalendarDays, Clock4, MapPin } from "lucide-react";
import React from "react";

interface TimeAndPlaceProps {
    address: string;
    setAddress: (val: string) => void;
    city: string;
    setCity: (val: string) => void;
    durationValue: string | number;
    setDurationValue: (val: string) => void;
    durationUnit: string;
    setDurationUnit: (val: string) => void;
    fromDate: string;
    setFromDate: (val: string) => void;
    toDate: string;
    setToDate: (val: string) => void;
}

export const TimeAndPlace: React.FC<TimeAndPlaceProps> = ({
    address,
    setAddress,
    city,
    setCity,
    durationValue,
    setDurationValue,
    durationUnit,
    setDurationUnit,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
}) => {
    const inputClasses = "w-full bg-[#FFFFFF] text-[16px] font-normal py-3 px-6 border border-[#0A0A0A1A] rounded-[14px] outline-none focus:border-[#4CAF50] transition-all box-border";

    return (
        <div className="space-y-6">
            <h2 className="text-[20px] font-bold leading-7 text-[#0A0A0A] pt-4">Tid og sted</h2>

            {/* 5. Sted (Adresse & By) - Responsive */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <p className="flex text-[14px] gap-2 items-center font-semibold text-[#0A0A0A] leading-5 pb-2">
                        <span className="text-[#2F7E47]"><MapPin size={16} /> </span>Sted
                        <span className="text-red-700 text-xl">*</span>
                    </p>
                    <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                        placeholder="F.eks. 'Oslo, Majorstuen' eller 'Bergen sentrum'"
                        className={inputClasses}
                    />
                </div>
                <div className="flex-1">
                    <p className="text-[14px] flex gap-2 items-center font-semibold text-[#0A0A0A] leading-5 pb-2">By <span className="text-red-700 text-xl">*</span></p>
                    <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                        placeholder="Oslo"
                        className={inputClasses}
                    />
                </div>
            </div>

            {/* 7. Varighet (Duration) - Responsive */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <p className="text-[14px] gap-2 items-center font-semibold text-[#0A0A0A] leading-5 pb-2">Estimert varighet <span className="text-red-700 text-xl">*</span></p>

                    <input
                        type="number"
                        value={durationValue}
                        onChange={(e) => setDurationValue(e.target.value)}
                        placeholder="2"
                        className={inputClasses}
                    />
                </div>
                <div className="flex-1">
                    <p className="flex text-[14px] gap-2 items-center font-semibold text-[#0A0A0A] leading-5 pb-2">
                        <span className="text-[#2F7E47]"><Clock4 size={16} /> </span>Tidspunkt
                        <span className="text-red-700 text-xl">*</span>
                    </p>

                    <select
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value)}
                        className={inputClasses}
                    >
                        <option value="minutes">Minutter</option>
                        <option value="hours">Timer</option>
                        <option value="days">Dager</option>
                    </select>
                </div>
            </div>

            {/* 8. Datoer - Responsive */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <p className="flex text-[14px] gap-2 items-center font-semibold text-[#0A0A0A] leading-5 pb-2">
                        <span className="text-[#2F7E47]"><CalendarDays size={16} /> </span>Fra dato
                        <span className="text-red-700 text-xl">*</span>
                    </p>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        required
                        className={inputClasses}
                    />
                </div>
                <div className="flex-1">
                    <p className="flex text-[14px] gap-2 items-center font-semibold text-[#0A0A0A] leading-5 pb-2">
                        <span className="text-[#2F7E47]"><CalendarDays size={16} /> </span>Til dato
                        <span className="text-red-700 text-xl">*</span>
                    </p>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        required
                        className={inputClasses}
                    />
                </div>
            </div>
        </div>
    );
};