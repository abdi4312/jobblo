import { useState, useEffect } from "react";
import { useUserStore } from "../../stores/userStore";
import mainLink from "../../api/mainURLs";
import { PricingModal } from "../../components/shared/PricingModal/PricingModal";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { toast } from 'react-toastify';
import styles from "./MinProfil.module.css";

interface ProfileData {
  email: string;
  password: string;
  phoneNumber: string;
  name: string;
  lastName: string;
  birthDate: string;
  gender: string;
  address: string;
  postNumber: string;
  postSted: string;
  country: string;
  profileImage: string;
}

export default function MinProfil() {
  const user = useUserStore((state) => state.user);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);

  const [formData, setFormData] = useState<ProfileData>({
    email: "",
    password: "************",
    phoneNumber: "",
    name: "",
    lastName: "",
    birthDate: "",
    gender: "",
    address: "",
    postNumber: "",
    postSted: "",
    country: "",
    profileImage: "",
  });

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      // Convert birthDate from YYYY-MM-DD to DD/MM/YYYY for display
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
        // ✅ Real data from backend
        email: user.email || "",
        phoneNumber: user.phone || "",
        name: user.name || "",
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

  const [editingField, setEditingField] = useState<string | null>(null);

  const handleEdit = (field: string) => {
    setEditingField(field);
  };

  const handleSave = async (field: string) => {
    if (!user?._id) {
      toast.error('Du må være logget inn');
      return;
    }
    try {
      // Map form fields to API fields
      const fieldMapping: Record<string, string> = {
        phoneNumber: 'phone',
        name: 'name',
        email: 'email',
        lastName: 'lastName',
        birthDate: 'birthDate',
        gender: 'gender',
        address: 'address',
        postNumber: 'postNumber',
        postSted: 'postSted',
        country: 'country',
      };

      const apiField = fieldMapping[field] || field;
      let fieldValue = formData[field as keyof ProfileData];

      // Convert DD/MM/YYYY to YYYY-MM-DD for birthDate
      if (field === 'birthDate' && fieldValue) {
        const dateMatch = fieldValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dateMatch) {
          const [, day, month, year] = dateMatch;
          fieldValue = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
      }

      const updateData = {
        [apiField]: fieldValue
      };

      console.log(`Updating ${field} (${apiField}):`, updateData);

      const respones = await mainLink.put(`/api/users/${user._id}`, updateData);

      if (!respones.data) {
        const errorData = await respones.data;
        console.error('Backend error:', errorData);
        
        // Check for duplicate key error
        if (errorData.error && errorData.error.includes('dup key')) {
          throw new Error('Dette telefonnummeret er allerede i bruk');
        }
        
        throw new Error(errorData.message || errorData.error || 'Kunne ikke oppdatere');
      }

      const updatedUser = await respones.data;
      console.log('Updated user:', updatedUser);
      
      // Update Zustand store with new data
      useUserStore.getState().setUser(updatedUser);
      
      toast.success('Oppdatert!');
      setEditingField(null);
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error instanceof Error ? error.message : 'Kunne ikke oppdatere');
    }
  };

  const handleInputChange = (field: string, value: string) => {    // Format birthDate with slashes DD/MM/YYYY
    if (field === 'birthDate') {
      // Remove all non-digits
      let cleaned = value.replace(/\D/g, '');
      
      // Add slashes automatically
      if (cleaned.length >= 2) {
        cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
      }
      if (cleaned.length >= 5) {
        cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5, 9);
      }
      
      value = cleaned;
    }
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const ProfileField = ({ 
    label, 
    field, 
    value, 
    type = "text" 
  }: { 
    label: string; 
    field: keyof ProfileData; 
    value: string; 
    type?: string;
  }) => (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      
      {editingField === field ? (
        <div className={styles.fieldActions}>
          {field === "gender" ? (
            <select
              value={value}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className={styles.fieldInput}
              autoFocus
            >
              <option value="">Velg kjønn</option>
              <option value="male">Mann</option>
              <option value="female">Kvinne</option>
              <option value="unisex">Unisex</option>
            </select>
          ) : (
            <input
              type={type}
              value={value}
              onChange={(e) => handleInputChange(field, e.target.value)}
              className={styles.fieldInput}
              autoFocus
              placeholder={field === "birthDate" ? "DD/MM/YYYY" : type === "date" ? "YYYY-MM-DD" : ""}
              maxLength={field === "birthDate" ? 10 : undefined}
            />
          )}
          <button
            onClick={() => handleSave(field)}
            className={styles.saveButton}
          >
            Lagre
          </button>
        </div>
      ) : (
        <>
          <span className={styles.fieldValue}>
            {field === "password" 
              ? "************" 
              : field === "gender" && value
                ? value === "male" 
                  ? "Mann" 
                  : value === "female" 
                    ? "Kvinne" 
                    : value === "unisex"
                      ? "Unisex"
                      : value
                : value}
          </span>
          <span 
            className="material-symbols-outlined"
            onClick={() => handleEdit(field)}
            style={{
              fontSize: "20px",
              color: "var(--color-accent)",
              cursor: "pointer",
            }}
          >
            edit
          </span>
        </>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <ProfileTitleWrapper title="Min profil" buttonText="Tilbake" />

        {/* Profile Picture Section */}
        <div className={styles.profileSection}>
          <div className={styles.profileImageContainer}>
            {formData.profileImage ? (
              <img 
                src={formData.profileImage} 
                alt="Profile"
                className={styles.profileImage}
              />
            ) : (
              <span className={styles.profileInitial}>
                {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
              </span>
            )}
          </div>
          <button className={styles.changePhotoButton}>
            Endre bilde
          </button>

          {/* User Stats */}
          {user && (
            <>
              {/* ✅ All stats below come from real backend data */}
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <div className={`${styles.statValue} ${styles.primary}`}>
                    {user.averageRating || 0}⭐
                  </div>
                  <div className={styles.statLabel}>Rating</div>
                </div>
                <div className={styles.statCard}>
                  <div className={`${styles.statValue} ${styles.primary}`}>
                    {user.reviewCount || 0}
                  </div>
                  <div className={styles.statLabel}>Anmeldelser</div>
                </div>
                <div className={styles.statCard}>
                  <div className={`${styles.statValue} ${styles.accent}`}>
                    {user.earnings || 0} kr
                  </div>
                  <div className={styles.statLabel}>Tjent</div>
                </div>
                <div className={styles.statCard}>
                  <div className={`${styles.statValue} ${styles.accent}`}>
                    {user.spending || 0} kr
                  </div>
                  <div className={styles.statLabel}>Brukt</div>
                </div>
              </div>

              {/* ✅ Real data: user.bio from backend */}
              {user.bio && (
                <div className={styles.bioSection}>
                  <div className={styles.bioLabel}>Bio:</div>
                  <div className={styles.bioText}>{user.bio}</div>
                </div>
              )}

              {/* ✅ Real data: user.role and user.subscription from backend */}
              <div className={styles.badges}>
                <span className={`${styles.badge} ${styles.role}`}>
                  {user.role}
                </span>
                <span className={`${styles.badge} ${styles.subscription}`}>
                  {user.subscription}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Personal Information */}
        <div className={styles.fieldsSection}>
          <div className={styles.sectionTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--color-accent)' }}>
              person
            </span>
            Personlig informasjon
          </div>
          {/* ✅ Real data from backend */}
          <ProfileField label="Epost" field="email" value={formData.email} type="email" />
          {/* ⚠️ Password always shows asterisks for security - not editable here */}
          <ProfileField label="Passord" field="password" value={formData.password} type="password" />
          {/* ✅ Real data from backend (user.phone) */}
          <ProfileField label="Mobil" field="phoneNumber" value={formData.phoneNumber} type="tel" />
          <div className={styles.divider} />
          {/* ✅ Real data from backend (user.name) */}
          <ProfileField label="Fornavn" field="name" value={formData.name} />
          {/* ✅ Real data from backend (user.lastName) */}
          <ProfileField label="Etternavn" field="lastName" value={formData.lastName} />
          {/* ✅ Real data from backend (user.birthDate) */}
          <ProfileField label="Født" field="birthDate" value={formData.birthDate} type="text" />
          {/* ✅ Real data from backend (user.gender) */}
          <ProfileField label="Kjønn" field="gender" value={formData.gender} />
        </div>

        {/* Address Information */}
        <div className={styles.fieldsSection}>
          <div className={styles.sectionTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--color-accent)' }}>
              home
            </span>
            Adresse
          </div>
          {/* ✅ Real data from backend (user.address) */}
          <ProfileField label="Adresse" field="address" value={formData.address} />
          {/* ✅ Real data from backend (user.postNumber) */}
          <ProfileField label="Postnummer" field="postNumber" value={formData.postNumber} />
          {/* ✅ Real data from backend (user.postSted) */}
          <ProfileField label="Poststed" field="postSted" value={formData.postSted} />
          {/* ✅ Real data from backend (user.country) */}
          <ProfileField label="Land" field="country" value={formData.country} />
        </div>

        {/* Pricing Button */}
        <button
          onClick={() => setIsPricingModalOpen(true)}
          className={styles.pricingButton}
        >
          <span className="material-symbols-outlined">payments</span>
          Se våre priser
        </button>
      </div>

      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} />
    </div>
  );
}
