import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import { useUpdateUser } from "../features/profile/hooks";

export type SettingsContextType = {
  user: any;
  form: {
    name: string;
    lastName: string;
    bio: string;
    phone: string;
    address: string;
    postNumber: string;
    postSted: string;
    country: string;
    email: string;
  };
  updateUser: any;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  handleChange: (key: string, value: string) => void;
  handleUpdate: () => void;
  handlePhotoSelect: () => void;
  handleCameraSelect: () => void;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function SettingsPage() {
  const user = useUserStore((state) => state.user);
  const updateUser = useUpdateUser();
  const [form, setForm] = useState({
    name: "",
    lastName: "",
    bio: "",
    phone: "",
    address: "",
    postNumber: "",
    postSted: "",
    country: "",
    email: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || "",
      lastName: user.lastName || "",
      bio: user.bio || "",
      phone: user.phone || "",
      address: user.address || "",
      postNumber: user.postNumber || "",
      postSted: user.postSted || "",
      country: user.country || "",
      email: user.email || "",
    });
  }, [user]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleUpdate = () => {
    if (!user?._id) return;
    updateUser.mutate({
      userId: user._id,
      data: {
        name: form.name,
        lastName: form.lastName,
        bio: form.bio,
        phone: form.phone,
        address: form.address,
        postNumber: form.postNumber,
        postSted: form.postSted,
        country: form.country,
        email: form.email,
      },
    });
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleCameraSelect = () => {
    cameraInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name);
      if (!user?._id) return;

      const formData = new FormData();
      formData.append("avatar", file);

      updateUser.mutate({
        userId: user._id,
        data: formData,
      });
    }
  };

  const context: SettingsContextType = {
    user,
    form,
    updateUser,
    fileInputRef,
    cameraInputRef,
    handleChange,
    handleUpdate,
    handlePhotoSelect,
    handleCameraSelect,
    handleFileChange,
  };

  return (
    <div className="py-2">
      <Outlet context={context} />
    </div>
  );
}
