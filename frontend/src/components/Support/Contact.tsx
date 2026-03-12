import { Mail, Phone, MessageCircle, Clock } from 'lucide-react';
import ContactForm from './ContactForm';

interface ContactDetail {
    icon: React.ElementType;
    title: string;
    value: string;
    subText: string;
    bgColor: string;
    iconColor: string;
}

const contactDetails: ContactDetail[] = [
    {
        icon: Mail,
        title: "E-post",
        value: "support@jobblo.no",
        subText: "Svar innen 24 timer",
        bgColor: "bg-[#2F7E4720]",
        iconColor: "text-[#2F7E47]",
    },
    {
        icon: Phone,
        title: "Telefon",
        value: "+47 123 45 678",
        subText: "Man-Fre 08:00-17:00",
        bgColor: "bg-[#E0883520]",
        iconColor: "text-[#E08835]",
    },
    {
        icon: MessageCircle,
        title: "Live Chat",
        value: "Start chat",
        subText: "Rask respons",
        bgColor: "bg-[#238CEB20]",
        iconColor: "text-[#238CEB]",
    },
    {
        icon: Clock,
        title: "Åpningstider",
        value: "Mandag - Fredag",
        subText: "08:00 - 17:00",
        bgColor: "bg-[#673AB720]",
        iconColor: "text-[#673AB7]",
    },
];

const Contact = () => {
    return (
        <div className="bg-white pt-16 px-4 font-sans">
            <div className="max-w-[1151px] mx-auto">

                {/* Header */}
                <div className="flex flex-col gap-4 text-center mb-16">
                    <h2 className="text-[23px] sm:text-[28px] md:text-[32px] font-bold text-[#0A0A0A]">Trenger du mer hjelp?</h2>
                    <p className="text-[#0A0A0A9E] text-[16px] font-normal">Vårt supportteam er her for å hjelpe deg</p>
                </div>

                <div className="flex flex-col lg:flex-row gap-12 lg:gap-24">

                    {/* Left Side: Kontakt oss details */}
                    <div className="flex-1">
                        <h3 className="text-[24px] font-bold text-[#0A0A0A] mb-6.5">Kontakt oss</h3>

                        <div className="space-y-6">
                            {contactDetails.map((item, index) => (
                                <div key={index} className="flex items-start gap-4">
                                    {/* Dynamic Icon Container */}
                                    <div className={`${item.bgColor} ${item.iconColor} p-3 rounded-[14px]`}>
                                        <item.icon size={24} />
                                    </div>

                                    {/* Text Details */}
                                    <div className='flex flex-col'>
                                        <h4 className=" text-[18px] font-bold text-[#0A0A0A]">{item.title}</h4>
                                        <p className="text-[#2F7E47] text-[16px] font-semibold">{item.value}</p>
                                        <p className="text-sm text-[#0A0A0A9E]">{item.subText}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Side: Form Card */}

                    <ContactForm />
                </div>

            </div>

            {/* Floating Chat Button */}
            <button className="fixed bottom-8 right-8 bg-[#2F7E47] text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform">
                <MessageCircle size={28} />
            </button>
        </div>
    );
};

export default Contact;