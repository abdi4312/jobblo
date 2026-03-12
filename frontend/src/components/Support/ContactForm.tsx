import { Send } from "lucide-react"

function ContactForm() {
    return (
        <>
            <div className="flex-1 bg-[linear-gradient(180deg,#F5F5F5_0%,#FFFFFF_100%)] p-8 rounded-[24px] shadow-sm">
                <h3 className="text-[24px] font-bold text-[#0A0A0A] mb-6">Send oss en melding</h3>

                <form className="space-y-4 p-0!">
                    <div>
                        <label className="block text-[14px] font-semibold text-[#0A0A0A] mb-2">Navn</label>
                        <input
                            type="text"
                            placeholder="Ditt fulle navn"
                            className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-gray-300"
                        />
                    </div>

                    <div>
                        <label className="block text-[14px] font-semibold text-[#0A0A0A] mb-2">E-post</label>
                        <input
                            type="email"
                            placeholder="din.epost@eksempel.no"
                            className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-gray-300"
                        />
                    </div>

                    <div>
                        <label className="block text-[14px] font-semibold text-[#0A0A0A] mb-2">Emne</label>
                        <input
                            type="text"
                            placeholder="Hva gjelder det?"
                            className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-gray-300"
                        />
                    </div>

                    <div>
                        <label className="block text-[14px] font-semibold text-[#0A0A0A] mb-2">Melding</label>
                        <textarea
                            rows={4}
                            placeholder="Beskriv problemet eller spørsmålet ditt..."
                            className="w-full p-4 rounded-xl border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-green-500 transition-all placeholder:text-gray-300 resize-none"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-[#2F7E47] hover:bg-[#1E5230] text-white py-4 text-[16px] rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors mt-4"
                    >
                        <Send size={18} />
                        Send melding
                    </button>
                </form>
            </div>
        </>
    )
}

export default ContactForm