import { Facebook, Twitter, Instagram, Linkedin } from "lucide-react";
import { NavLink } from "react-router-dom";
import FooterImg from "../../assets/images/Footer/footer-img.png";

const SocialIcon = [
    { Icon: Facebook, href: "#" },
    { Icon: Twitter, href: "#" },
    { Icon: Instagram, href: "#" },
    { Icon: Linkedin, href: "#" },
]

const Product = [
    { name: "Funksjoner", link: "#" },
    { name: "Priser", link: "#" },
    { name: "Integrasjoner", link: "#" },
    { name: "API", link: "#" }
]
const Resources = [
    { name: "Blogg", link: "#" },
    { name: "Hjelpesenter", link: "#" },
    { name: "Webinarer", link: "#" },
    { name: "Partnere", link: "#" }
]
const Company = [
    { name: "Om oss", link: "#" },
    { name: "Karriere", link: "#" },
    { name: "Presse", link: "#" },
    { name: "Kontakt", link: "#" }
]
const Legal = [
    { name: "Personvern", link: "#" },
    { name: "Vilkår", link: "#" },
    { name: "Cookies", link: "#" },
    { name: "Lisenser", link: "#" }
]

export default function Content() {
    return (
        <div className="max-w-300 mx-auto flex flex-col lg:flex-row justify-between gap-12 mb-16 overflow-hidden">
            <div className="lg:col-span-2">
                <div className="mb-8 lg:max-w-106.25">
                    <p className="text-white text-[20px] sm:text-[26px] text-center md:text-[32px] font-normal italic tracking-[-1px] lg:text-left">
                        Norges ledende plattform for fleksibelt arbeid og spennende
                        oppdrag.
                    </p>
                </div>

                {/* Social Icons */}
                <div className="flex gap-4 justify-center lg:justify-start">
                    {SocialIcon.map(({ Icon, href }, index) => (
                        <a
                            key={index}
                            href={href}
                            className="w-11 h-11 rounded-full bg-emerald-800/50 hover:bg-emerald-700 flex items-center justify-center transition-all duration-300 border border-emerald-600/30 hover:border-emerald-500 hover:scale-110"
                        >
                            <Icon size={20} className="text-emerald-100" />
                        </a>
                    ))}
                </div>
            </div>

            <div className="flex justify-center items-center lg:hidden">
                <img src={FooterImg} alt="Footer Image" className="w-45.75 h-[78.1px] sm:w-52 sm:h-25" />
            </div>

            <div className='flex justify-between gap-6 md:gap-16'>
                <div className='max-w-14 md:max-w-20'>
                    <h4 className="text-white font-medium mb-4 text-base">
                        Produkt
                    </h4>
                    <ul className="space-y-3">
                        {Product.map((item, index) => (
                            <li key={index}>
                                <NavLink
                                    to={item.link}
                                    className="text-white! text-sm font-normal duration-200 hover:text-[#D67E2B]!"
                                >
                                    {item.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className='max-w-14 md:max-w-20'>
                    <h4 className="text-white font-medium mb-4 text-base">
                        Ressurser
                    </h4>
                    <ul className="space-y-3">
                        {Resources.map(
                            (item, index) => (
                                <li key={index}>
                                    <NavLink
                                        to={item.link}
                                        className="text-white! text-sm font-normal duration-200 hover:text-[#D67E2B]!"
                                    >
                                        {item.name}
                                    </NavLink>
                                </li>
                            ),
                        )}
                    </ul>
                </div>

                <div className='max-w-14 md:max-w-20'>
                    <h4 className="text-white font-medium mb-4 text-base">
                        Selskap
                    </h4>
                    <ul className="space-y-3">
                        {Company.map((item, index) => (
                            <li key={index}>
                                <NavLink
                                    to={item.link}
                                    className="text-white! text-sm font-normal duration-200 hover:text-[#D67E2B]!"
                                >
                                    {item.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className='max-w-14 md:max-w-20'>
                    <h4 className="text-white font-medium mb-4 text-base">
                        Juridisk
                    </h4>
                    <ul className="space-y-3">
                        {Legal.map((item, index) => (
                            <li key={index}>
                                <NavLink
                                    to={item.link}
                                    className="text-white! text-sm font-normal duration-200 hover:text-[#D67E2B]!"
                                >
                                    {item.name}
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}
