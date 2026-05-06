import { NavLink } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { name: "Kundesenter", link: "/support" },
    { name: "Jobb i Jobblo", link: "/sale-subscription-terms" },
    { name: "Personvern", link: "/privacy" },
    { name: "Vilkår for bruk", link: "/user-term" },
    { name: "Om oss", link: "/about" },
    { name: "Cookie-innstillinger", link: "/cookies" },
  ];

  return (
    <footer className="w-full py-8 mt-auto">
      <div className="max-w-300 mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-base text-custom-black">
        {/* Left Side: Links */}
        <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2">
          {footerLinks.map((item, index) => (
            <NavLink
              key={index}
              to={item.link}
              className="hover:underline transition-all duration-200 text-custom-black!"
            >
              {item.name}
            </NavLink>
          ))}

          {/* Country Selector Placeholder */}
          <div className="flex items-center gap-1 cursor-pointer hover:underline">
            <span className="font-bold text-[10px] uppercase">no</span>
            <span>Norway</span>
          </div>
        </div>

        {/* Right Side: Copyright */}
        <div className="text-custom-black whitespace-nowrap">
          © Jobblo AS {currentYear}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
