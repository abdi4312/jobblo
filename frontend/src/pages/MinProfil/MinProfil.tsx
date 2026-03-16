import { useState, useEffect } from "react";
import { useUserStore } from "../../stores/userStore";
import { PricingModal } from "../../components/shared/PricingModal/PricingModal";
import { toast } from 'react-toastify';
import { UserStats } from "../../components/MinProfile/UserStats";
import { ProfileImage } from "../../components/MinProfile/ProfileImage";
import { ProfileField } from "../../components/MinProfile/ProfileField";
import { House, User } from "lucide-react";
import { useUpdateUser } from "../../features/profile/hooks";
import type { ProfileData } from "../../features/profile/types/user";

export default function MinProfil() {
  const user = useUserStore((state) => state.user);
  const updateUserMutation = useUpdateUser();
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProfileData>({
    email: "",
    password: "************",
    phoneNumber: "",
    name: "",
    lastName: "",
    birthDate: "",
    gender: "",
    bio: "",
    address: "",
    postNumber: "",
    postSted: "",
    country: "",
    profileImage: "",
  });

  useEffect(() => {
    if (user) {
      let displayBirthDate = "";
      if (user.birthDate) {
        const dateMatch = user.birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (dateMatch) {
          const [, year, month, day] = dateMatch;
          displayBirthDate = `${day}/${month}/${year}`;
        } else {
          displayBirthDate = user.birthDate;
        }
      }

      setFormData(prev => ({
        ...prev,
        email: user.email || "",
        phoneNumber: user.phone || "",
        name: user.name || "",
        bio: user.bio || "",
        profileImage: user.avatarUrl || "",
        lastName: user.lastName || "",
        birthDate: displayBirthDate,
        gender: user.gender || "",
        address: user.address || "",
        postNumber: user.postNumber || "",
        postSted: user.postSted || "",
        country: user.country || "",
      }));
    }
  }, [user]);

  const handleEdit = (field: string) => setEditingField(field);

  const handleSave = async (field: string) => {
    if (!user?._id) {
      toast.error('Du må være logget inn');
      return;
    }

    const fieldMapping: Record<string, string> = {
      phoneNumber: 'phone',
      name: 'name',
      email: 'email',
      lastName: 'lastName',
      birthDate: 'birthDate',
      gender: 'gender',
      bio: 'bio',
      address: 'address',
      postNumber: 'postNumber',
      postSted: 'postSted',
      country: 'country',
    };

    const apiField = fieldMapping[field] || field;
    let fieldValue = formData[field as keyof ProfileData];

    // Date formatting logic
    if (field === 'birthDate' && fieldValue) {
      const dateMatch = fieldValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        fieldValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }

    // Call Mutation
    updateUserMutation.mutate({
      userId: user._id,
      data: { [apiField]: fieldValue }
    }, {
      onSuccess: () => setEditingField(null)
    });
  };

  const handleInputChange = (field: string, value: string) => {
    if (field === 'birthDate') {
      let cleaned = value.replace(/\D/g, '');
      if (cleaned.length >= 2) cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
      if (cleaned.length >= 5) cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5, 9);
      value = cleaned;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const sections = [
    {
      title: "Personlig informasjon", icon: <User size={24} />, fields: [
        { label: "Epost", field: "email", type: "email" },
        { label: "Passord", field: "password", type: "password" },
        { label: "Mobil", field: "phoneNumber", type: "tel" },
        { label: "Fornavn", field: "name" },
        { label: "Etternavn", field: "lastName" },
        { label: "Født", field: "birthDate" },
        { label: "Kjønn", field: "gender" },
        { label: "bio", field: "bio" }
      ]
    },
    {
      title: "Adresse", icon: <House size={24} />, fields: [
        { label: "Adresse", field: "address" },
        { label: "Postnummer", field: "postNumber" },
        { label: "Poststed", field: "postSted" },
        { label: "Land", field: "country" }
      ]
    }
  ];

  const handleImageChange = async (file: File) => {
    if (!user?._id) return;

    const formDataUpload = new FormData();
    formDataUpload.append("avatar", file);

    updateUserMutation.mutate({
      userId: user._id,
      data: formDataUpload
    });
  };

  return (
    <div className="min-h-screen max-w-300 mx-auto px-4 py-5 flex flex-col items-center overflow-x-hidden">
      <div className="w-full flex flex-col gap-6">
        <div className="bg-[#FFFFFF40] rounded-xl p-6 shadow-sm flex flex-col items-center gap-4">
          <h1 className="text-[#101828] text-[30px] font-bold">Min profill</h1>
          <ProfileImage
            imageUrl={formData.profileImage}
            name={formData.name}
            onImageChange={handleImageChange}
            isUploading={updateUserMutation.isPending}
          />
          <UserStats user={user} />
        </div>

        {sections.map((section, idx) => (
          <div key={idx} className="bg-[#FFFFFF40] rounded-xl p-5 shadow-sm">
            <div className="text-[#000000] mb-4 flex items-center gap-4">
              <span>{section.icon}</span>
              <span className="text-[24px] font-semibold">{section.title}</span>
            </div>
            {section.fields.map((f: any) => (
              <div key={f.field}>
                {f.label === "Fornavn" && <div className="h-[1px] bg-black/5 my-2" />}
                <ProfileField
                  label={f.label}
                  field={f.field}
                  value={(formData as any)[f.field]}
                  initialValue={(user as any)[f.field === 'phoneNumber' ? 'phone' : f.field] || ""}
                  type={f.type}
                  isEditing={editingField === f.field}
                  onEdit={handleEdit}
                  onSave={handleSave}
                  onChange={handleInputChange}
                  isLoading={updateUserMutation.isPending && editingField === f.field}
                />
              </div>
            ))}
          </div>
        ))}

        <button
          onClick={() => setIsPricingModalOpen(true)}
          className="w-full p-4 bg-gradient-to-r from-[#2F7E47] to-[#153014] text-white rounded-xl text-lg font-semibold flex items-center justify-center gap-2 shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <span className="material-symbols-outlined">payments</span>
          Se våre priser
        </button>
      </div>
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </div>
  );
}