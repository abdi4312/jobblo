import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Ui/button/Button';
import { getCookieConsent, setCookieConsent } from '../../utils/cookieConsent';

/**
 * Was entirely in English on a Norwegian-first product, offered no way to refuse
 * (only "Accept" and a "Customise" that silently accepted), and linked to
 * /cookie-policy, which is not a route — the page is /cookies.
 */
export const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (getCookieConsent() === null) {
      setIsVisible(true);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const choose = (value: 'accepted' | 'rejected') => () => {
    setCookieConsent(value);
    document.body.style.overflow = 'auto';
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-100000 flex items-center justify-center p-2"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
    >
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative bg-white w-full max-w-137.5 rounded-[20px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 py-5">
          <h2 id="cookie-title" className="text-2xl font-medium text-custom-black mb-2">
            Informasjonskapsler
          </h2>

          <p className="text-custom-black/60 text-base leading-relaxed mb-4">
            Vi bruker informasjonskapsler som er nødvendige for at Jobblo skal fungere. Med ditt
            samtykke bruker vi dem også til å forstå hvordan nettstedet brukes og til å vise
            relevant innhold og annonser. Du kan lese mer i{' '}
            <Link
              to="/cookies"
              className="text-custom-black! font-semibold underline! underline-offset-4"
            >
              retningslinjene våre for informasjonskapsler
            </Link>
            .
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={choose('rejected')}
              label="Bare nødvendige"
              className="py-3 px-8 bg-white! text-custom-black! border! border-black/15!"
            />
            <Button onClick={choose('accepted')} label="Godta alle" className="py-3 px-8" />
          </div>
        </div>
      </div>
    </div>
  );
};
