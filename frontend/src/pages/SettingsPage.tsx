import { useEffect, useRef, useState } from 'react';
import { useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useUserStore } from '../stores/userStore';
import { useUpdateUser } from '../features/profile/hooks';
import { toast } from 'react-hot-toast';

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
  // Explicitly typed: `skills: []` and `locations: []` were inferred as never[],
  // so assigning the user's real string arrays in the effect below was an error.
  const [form, setForm] = useState<Record<string, unknown>>({
    name: '',
    lastName: '',
    bio: '',
    phone: '',
    address: '',
    postNumber: '',
    postSted: '',
    country: '',
    email: '',
    availabilityText: '',
    skills: [],
    companyName: '',
    orgNumber: '',
    orgType: '',
    locations: [],
    website: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name || '',
      lastName: user.lastName || '',
      bio: user.bio || '',
      phone: user.phone || '',
      address: user.address || '',
      postNumber: user.postNumber || '',
      postSted: user.postSted || '',
      country: user.country || '',
      email: user.email || '',
      availabilityText: (user as any).availabilityText || '',
      skills: (user as any).skills || [],
      companyName: user.companyName || '',
      orgNumber: user.orgNumber || '',
      orgType: user.orgType || '',
      locations: user.locations || [],
      website: user.website || '',
    });
  }, [user]);

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Sends only what the user actually changed.
   *
   * Every save used to POST all 21 fields, so editing your bio also re-submitted
   * email, phone, address and orgNumber. Anything stale in this tab silently
   * overwrote the server's newer value — last-write-wins across tabs and devices.
   */
  const handleUpdate = () => {
    if (!user?._id) return;

    const current: Record<string, unknown> = {
      name: user.name || '',
      lastName: user.lastName || '',
      bio: user.bio || '',
      phone: user.phone || '',
      address: user.address || '',
      postNumber: user.postNumber || '',
      postSted: user.postSted || '',
      country: user.country || '',
      email: user.email || '',
      availabilityText: (user as any).availabilityText || '',
      skills: (user as any).skills || [],
      companyName: user.companyName || '',
      orgNumber: user.orgNumber || '',
      orgType: user.orgType || '',
      locations: user.locations || [],
      website: user.website || '',
    };

    const changed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      const isSame =
        Array.isArray(value) || Array.isArray(current[key])
          ? JSON.stringify(value) === JSON.stringify(current[key] ?? [])
          : value === current[key];
      if (!isSame) changed[key] = value;
    }

    if (Object.keys(changed).length === 0) {
      toast('Ingen endringer å lagre.');
      return;
    }

    updateUser.mutate({ userId: user._id, data: changed });
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
      console.log('File selected:', file.name);
      if (!user?._id) {
        toast.error('User not found');
        return;
      }

      const formData = new FormData();
      // Check path directly from location for reliability
      const isBanner = window.location.pathname.includes('banner');
      console.log('Is banner upload:', isBanner);

      formData.append(isBanner ? 'banner' : 'avatar', file);

      updateUser.mutate({
        userId: user._id,
        data: formData as any,
      });

      // Reset input value so same file can be selected again if needed
      if (event.target) {
        event.target.value = '';
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
