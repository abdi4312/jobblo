import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { Coins } from "lucide-react";
import Verified from "../../verified/Verified";

export function CoinsSection() {
  const { fetchProfile } = useUserStore((state) => state);
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const userPoints = user?.pointsBalance || 0;

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUseCoins = () => {
    navigate("/coins");
  };

  return (
    <>
      <div className=" grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-2.5 p-6 rounded-[14px] shadow-md">

          <div className="flex justify-between">
            <h2 className="text-[16px] font-normal text-[#0A0A0A]">Dine Coins</h2>
            <div className="text-[#2F7E47] flex items-center gap-3">
              <span><Coins size={32} /></span>
              <span className="text-[48px] font-bold leading-12">{userPoints}</span>
            </div>
          </div>

          <div className="cursor-pointer" onClick={handleUseCoins}>
            <button className="bg-[#2F7E47] w-full py-3 text-[16px] text-white font-semibold rounded-xl cursor-pointer">Bruk Coins</button>
          </div>
        </div>
        <Verified />
      </div>
    </>
  );
}
