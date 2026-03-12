import { Search } from "lucide-react"

function Header() {
    return (
        <>
            <div className="flex flex-col gap-6 justify-center items-center bg-[linear-gradient(180deg,#2F7E47_0%,#1E5230_100%)] text-[#FFFFFF] py-[60px] md:py-[96px] px-4 text-center">

                <h1 className="text-[32px] md:text-[56px] font-bold leading-tight">
                    Hvordan kan vi hjelpe deg?
                </h1>

                <p className="text-[#FFFFFFE5] text-[16px] md:text-[20px] font-normal max-w-[800px]">
                    Søk etter svar, utforsk hjelpeartikler eller ta kontakt med vårt supportteam
                </p>

                <div className="w-full flex justify-center px-4">
                    <div className="relative w-full max-w-[672px]">
                        {/* Search Icon */}
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#0A0A0A80]">
                            <Search size={24} strokeWidth={1.5} />
                        </div>

                        {/* Search Input */}
                        <input
                            type="text"
                            placeholder="Søk i hjelpesenter..."
                            className="w-full h-[56px] md:h-[68px] pl-14 pr-6 py-6 text-[#0A0A0A80] text-[16px] md:text-[18px] rounded-[16px] font-normal bg-[#FFFFFF] border-0 outline-0 shadow-lg"
                        />
                    </div>
                </div>
            </div>
        </>
    )
}

export default Header