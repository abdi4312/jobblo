import { ProfileHeader } from "./ProfileHeader/ProfileHeader";
import { CoinsSection } from "./CoinsSection/CoinsSection";
import { ProfileMenuSection } from "./ProfileMenuSection/ProfileMenuSection";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { App } from 'antd';

export default function ProfilePage() {
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();
  const { modal } = App.useApp();

  const handleLogout = () => {
    modal.confirm({
      title: 'Er du sikker?',
      content: 'Vil du virkelig logge ut?',
      okText: 'Ja, logg ut',
      cancelText: 'Avbryt',
      onOk() {
        logout();
        toast.success("Du har blitt logget ut");
        navigate("/");
      },
    });
  };

  return (
    <>
      <div className="max-w-300 mx-auto">
        <div className=" bg-white p-4 md:p-6">
          <ProfileHeader handlelogout={handleLogout} />
          {/* <Verified /> */}
          <CoinsSection />
        </div>
        
        <div className="p-4 md:p-6 bg-white mt-6">
          <ProfileMenuSection />
        </div>
      </div>
    </>
  );
}
