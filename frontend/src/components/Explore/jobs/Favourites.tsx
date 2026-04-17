import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FAVOURITES_DATA } from "../../../data/favourites";

import "swiper/css";

export function Favourites() {
    const columns = [];
    for (let i = 0; i < FAVOURITES_DATA.length; i += 2) {
        columns.push(FAVOURITES_DATA.slice(i, i + 2));
    }

    return (
        <div className="w-full py-16 overflow-hidden">
            <div className="w-full max-w-300 mx-auto px-4">
                {/* Header Section */}
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-[#0A0A0A] tracking-tight">Våre favoritter</h2>
                        <p className="text-gray-500 mt-2 text-[15px]">Finn inspiration i våre favoritter</p>
                    </div>

                    {/* Custom Navigation Arrows */}
                    <div className="lg:flex gap-3 hidden">
                        <button id="fav-prev" className="w-11 h-11 rounded-full border border-[#0A0A0A] flex items-center
                        justify-center hover:bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10 bg-transparent">
                            <ChevronLeft size={22} className="text-gray-600 stroke-[1.5]" />
                        </button>
                        <button id="fav-next" className="w-11 h-11 rounded-full border border-[#0A0A0A] flex items-center justify-center
                        hover:bg-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed z-10 bg-transparent">
                            <ChevronRight size={22} className="text-gray-600 stroke-[1.5]" />
                        </button>
                    </div>
                </div>

                {/* Grid / Swiper */}

                <Swiper
                    modules={[Navigation]}
                    navigation={{
                        prevEl: "#fav-prev",
                        nextEl: "#fav-next",
                    }}
                    // 1. Transition speed (milli-seconds mein). 800ms-1000ms smooth lagta hai.
                    speed={1000}

                    // 2. Grab cursor taaki user ko pata chalay ye draggable hai
                    grabCursor={true}

                    // 3. Resistance aur touch smoothing
                    touchEventsTarget="container"
                    edgeSwipeThreshold={20}

                    spaceBetween={16}
                    slidesPerView={1.2}
                    slidesPerGroup={1}
                    breakpoints={{
                        480: { slidesPerView: 2, slidesPerGroup: 2, speed: 800 },
                        768: { slidesPerView: 3, slidesPerGroup: 3, speed: 900 },
                        1024: {
                            slidesPerView: 4,
                            slidesPerGroup: 4,
                            speed: 1000 // Desktop pe slow aur smooth transition
                        },
                    }}
                    className="favourites-swiper overflow-visible!"
                >
                    {columns.map((col, idx) => (
                        <SwiperSlide key={idx} className="mr-2!">
                            <div className="flex flex-col gap-2">
                                {col.map((item) => (
                                    <div key={item.id} className="relative aspect-[3.5/4] md:aspect-[4/4.5] rounded-[20px] overflow-hidden group cursor-pointer bg-gray-200">
                                        {/* Image */}
                                        <img
                                            src={`${item.image}?auto=format&fit=crop&w=500&q=80`}
                                            alt={item.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 block"
                                        />

                                        {/* Gradient Overlay (Dark bottom) */}
                                        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-linear-to-t from-[#0b1712]/90 via-[#0b1712]/40 to-transparent pointer-events-none" />

                                        {/* Fri frakt Badge (Top Right Corner Ribbon) */}
                                        {item.badge && (
                                            <div className="absolute top-0 right-0 w-[100px] h-[100px] overflow-hidden pointer-events-none rounded-tr-[20px] z-20">
                                                <div className="absolute top-5 right-[-35px] w-36 bg-[#163324] text-white text-[11px] font-bold text-center py-1.5 rotate-45 shadow-[0_2px_4px_rgba(0,0,0,0.3)] tracking-widest uppercase">
                                                    {item.badge}
                                                </div>
                                            </div>
                                        )}

                                        {/* Center Text */}
                                        <div className="absolute inset-0 flex items-center justify-center px-6 z-10 pointer-events-none">
                                            <h3 className="text-white text-center font-bold text-lg md:text-xl leading-tight tracking-tight drop-shadow-md">
                                                {item.title}
                                            </h3>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SwiperSlide>
                    ))}
                </Swiper>
            </div>
        </div>
    );
}