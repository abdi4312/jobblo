import React, { useState, useEffect } from "react";
import { Cookie } from "lucide-react";
import { Button } from "../../components/Ui/button/Button";

export const CookieBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      setIsVisible(true);
      // Disable scrolling when modal is open
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    document.body.style.overflow = "auto";
    setIsVisible(false);
  };

  const handleCustomise = () => {
    // For now, we'll treat customise as a partial accept or just close
    // In a real app, this would open detailed settings
    localStorage.setItem("cookie-consent", "customised");
    document.body.style.overflow = "auto";
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-100000 flex items-center justify-center p-2">
      {/* Backdrop - blocks access to the page */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-137.5 rounded-[20px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="px-6 py-4">
          <h2 className="text-2xl font-medium text-custom-black mb-2">Cookies</h2>

          <p className="text-custom-black/60 text-base leading-relaxed mb-2">
            We use cookies to learn how you use our website and to show you
            relevant content and ads based on your interests. You can manage
            your settings below. If you want to know more about the cookies we
            use on our website, you can read our{" "}
            <a
              href="/cookie-policy"
              className="text-custom-black! font-semibold underline! underline-offset-4"
            >
              Cookie Policy
            </a>
            .
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleCustomise}
              label="Customise"
              className="py-3 px-8"
            />
            <Button
              onClick={handleAccept}
              label="Accept"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
