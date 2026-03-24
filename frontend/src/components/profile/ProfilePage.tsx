import { ProfileHeader } from "./ProfileHeader/ProfileHeader";
import { ItemsGrid } from "./ProfileHeader/ItemsGrid";
import { useUserStore } from "../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import { App } from 'antd';
import { useState } from 'react';

export default function ProfilePage() {
  const logout = useUserStore((state) => state.logout);
  const navigate = useNavigate();
  const { modal } = App.useApp();
  const [activeTab, setActiveTab] = useState('Likes');

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
      <div className="">
        <div className="bg-white border-b border-gray-100">
          <ProfileHeader
            handlelogout={handleLogout}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        <ItemsGrid activeTab={activeTab} />
      </div>
    </>
  );
}
