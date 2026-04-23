import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { PricingModal } from "../../shared/PricingModal/PricingModal";
import {
  ChevronRight,
  Headset,
  Heart,
  Megaphone,
  Rocket,
  Settings,
  Star,
  Tag,
  User,
  Wallet,
} from "lucide-react";

export function ProfileMenuSection() {
  const navigate = useNavigate();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const menuItems = [
    {
      icon: Megaphone,
      text: "Mine annonser",
      des: "Se og endre dine annonser",
      path: "/Mine-annonser",
    },
    {
      icon: Heart,
      text: "Favoritter",
      des: "Se og endre dine favoritt-jobber",
      path: "/favorites",
    },
    {
      icon: Star,
      text: "Anmeldelser",
      des: "Se og endre dine anmeldelser",
      path: "/Anmeldelser",
    },
    {
      icon: Headset,
      text: "Kundeservice",
      des: "Kontakt oss for hjelp",
      path: "/Support",
    },
    {
      icon: Rocket,
      text: "Upcoming",
      des: "Se hva vi jobber med",
      path: "/Upcoming",
    },
    {
      icon: Tag,
      text: "Se våre priser",
      des: "Se våre priser for ulike tjenester",
      isModal: true,
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-4">
        {menuItems.map((item, index) => {
          return (
            <div
              key={index}
              className="flex justify-between items-center bg-white p-4.5 rounded-xl shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => {
                if (item.isModal) {
                  setIsPricingModalOpen(true);
                } else if (item.path) {
                  navigate(item.path);
                }
              }}
            >
              <div className="flex items-center gap-8">
                <div className="bg-white text-[#2F7E47] rounded-[14px] shadow-md flex items-center justify-center p-4.5">
                  <item.icon size={20} />
                </div>
                <div>
                  <h2 className="text-[20px] font-bold text-[#0A0A0A]">
                    {item.text}
                  </h2>
                  <span className="text-[14px] font-medium">{item.des}</span>
                </div>
              </div>
              <div>
                <ChevronRight size={20} />
              </div>
            </div>
          );
        })}
      </div>
      <PricingModal
        isOpen={isPricingModalOpen}
        onClose={() => setIsPricingModalOpen(false)}
      />
    </>
  );
}
