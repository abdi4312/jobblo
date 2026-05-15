import { useEffect, useRef, useState } from "react";
import { useLocation, Outlet, useNavigate } from "react-router-dom";
import { useUserStore } from "../stores/userStore";
import { useUpdateUser } from "../features/profile/hooks";
import { toast } from "react-hot-toast";

interface UserData {
  _id?: string;
  name?: string;
  lastName?: string;
  email?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  phone?: string;
  bio?: string;
}

interface UpdateUserResult {
  mutateAsync: (data: FormData) => Promise<unknown>;
  isPending: boolean;
}

export type SettingsContextType = {
  user: any;
  form: any;
  updateUser: any;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  handleChange: (key: string, value: any) => void;
  handleUpdate: () => void;
  handlePhotoSelect: () => void;
  handleCameraSelect: () => void;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
    availabilityText: "",
    skills: [],
    companyName: "",
    orgNumber: "",
    orgType: "",
    locations: [],
    website: "",
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
      availabilityText: (user as any).availabilityText || "",
      skills: (user as any).skills || [],
      companyName: user.companyName || "",
      orgNumber: user.orgNumber || "",
      orgType: user.orgType || "",
      locations: user.locations || [],
      website: user.website || "",
    });
  }, [user]);

  const handleChange = (key: string, value: any) => {
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
        availabilityText: form.availabilityText,
        skills: form.skills,
        companyName: form.companyName,
        orgNumber: form.orgNumber,
        orgType: form.orgType,
        locations: form.locations,
        website: form.website,
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
      if (!user?._id) {
        toast.error("User not found");
        return;
      }

      const formData = new FormData();
      // Check path directly from location for reliability
      const isBanner = window.location.pathname.includes("banner");
      console.log("Is banner upload:", isBanner);

      formData.append(isBanner ? "banner" : "avatar", file);

      updateUser.mutate({
        userId: user._id,
        data: formData as any,
      });

      // Reset input value so same file can be selected again if needed
      if (event.target) {
        event.target.value = "";
      }
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
