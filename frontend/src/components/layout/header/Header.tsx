import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { VerticalDivider } from "../../component/divider/verticalDivider/VerticalDivider.tsx";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from 'react-toastify';

export default function Header() {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast.warning("Du må være logget inn for å få tilgang");
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  return (
    <div className="bg-[#fcf9eb] max-w-325 grid grid-cols-[1fr_auto_1fr] items-center h-15 px-5 relative z-10 mx-auto">
      
      {/* Jobblo Icon */}
      <div className="cursor-pointer" onClick={() => navigate("/")}>
        <Icons.JobbloIcon />
      </div>

      {/* Icon Container */}
      <div className="flex items-center gap-2 justify-self-center">
        <Icons.BellIcon onClick={() => handleProtectedNavigation("/Alert")} />
        <VerticalDivider />
        <Icons.PlusIcon onClick={() => handleProtectedNavigation("/publish-job")} />
        <VerticalDivider />
        <Icons.MessageIcon onClick={() => handleProtectedNavigation("/messages")} />
      </div>

      {/* Button Container */}
      <div className="flex gap-2.5 justify-self-end">
        <VippsButton />
      </div>
    </div>
  );
}
