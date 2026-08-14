import { NavLink } from 'react-router-dom';
import { CONTAINER } from '../../../theme/brand';

/**
 * The site footer.
 *
 * It used `max-w-300` with no gutters, so on anything narrower than 1200 px the links
 * ran flush to the viewport edge while the header above them held a 20–48 px margin —
 * the two were the same width but never lined up. It now shares `CONTAINER` with the
 * header and every landing section, so the alignment cannot drift again, and a hairline
 * separates it from the page rather than leaving the last section floating into it.
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { name: 'Kundesenter', link: '/support' },
    { name: 'Priser', link: '/pricing' },
    { name: 'Vilkår for bruk', link: '/sale-subscription-terms' },
    { name: 'Om oss', link: '/about' },
    { name: 'Cookie-innstillinger', link: '/cookies' },
  ];

  return (
    <footer className="mt-auto w-full">
      <div className={CONTAINER}>
        <div className="flex flex-col items-center justify-between gap-6 border-t border-[#E6E7E1] py-10 text-[0.875rem] text-[#63665F] md:flex-row">
          {/* Left Side: Links */}
          <nav className="flex flex-wrap justify-center gap-x-7 gap-y-3 md:justify-start">
            {footerLinks.map((item) => (
              <NavLink
                key={item.link}
                to={item.link}
                className="rounded text-[#63665F]! transition-colors hover:text-[#0B0B0B]! hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E6641]/25"
              >
                {item.name}
              </NavLink>
            ))}

            {/* Country Selector Placeholder */}
            <span className="flex items-center gap-1.5">
              <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em]">no</span>
              Norway
            </span>
          </nav>

          {/* Right Side: Copyright */}
          <p className="whitespace-nowrap text-[#9B9E96]">© Jobblo AS {currentYear}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
