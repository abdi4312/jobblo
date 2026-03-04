import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { Coins } from "lucide-react";
import Verified from "../../verified/Verified";

interface Level {
  name: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  gradient: string;
}

const levels: Level[] = [
  { name: "Ny på Jobblo", minPoints: 0, maxPoints: 9, color: "#808080", gradient: "linear-gradient(180deg, #A0A0A0 0%, #606060 100%)" },
  { name: "Aktiv", minPoints: 10, maxPoints: 24, color: "#10B981", gradient: "linear-gradient(180deg, #34D399 0%, #059669 100%)" },
  { name: "Pålitelig", minPoints: 25, maxPoints: 49, color: "#3B82F6", gradient: "linear-gradient(180deg, #60A5FA 0%, #2563EB 100%)" },
  { name: "Profesjonell", minPoints: 50, maxPoints: 99, color: "#A855F7", gradient: "linear-gradient(180deg, #C084FC 0%, #9333EA 100%)" },
  { name: "Ekspert", minPoints: 100, maxPoints: 199, color: "#F97316", gradient: "linear-gradient(180deg, #FB923C 0%, #EA580C 100%)" },
  { name: "Mester", minPoints: 200, maxPoints: Infinity, color: "#FFD700", gradient: "linear-gradient(180deg, #FDE047 0%, #FACC15 100%)" },
];

function getLevelInfo(points: number): Level {
  return levels.find(level => points >= level.minPoints && points <= level.maxPoints) || levels[0];
}

export function CoinsSection() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { fetchProfile, } = useUserStore((state) => state);
  const user = useUserStore((state) => state.user);
  const navigate = useNavigate();
  const userPoints = user?.pointsBalance || 0;
  const levelInfo = getLevelInfo(userPoints);
  useEffect(() => {
    fetchProfile();
  }, []);
  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

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
