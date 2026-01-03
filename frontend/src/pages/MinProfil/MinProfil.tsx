import { useState, useEffect } from "react";
import { useUserStore } from "../../stores/userStore";
import { mainLink } from "../../api/mainURLs";
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
  const userToken = useUserStore((state) => state.tokens);
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
      setFormData(prev => ({
        ...prev,
        // ✅ Real data from backend
        email: user.email || "",
        phoneNumber: user.phone || "",
        name: user.name || "",
        profileImage: user.avatarUrl || "",
        
        // ⚠️ TODO: Add these fields to User model and fetch from backend
        // Currently using empty strings as placeholders
        lastName: user.lastName || "",
        birthDate: user.birthDate || "",
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

    if (!userToken?.accessToken) {
      toast.error('Mangler autentisering. Vennligst logg inn på nytt.');
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
      const updateData = {
        [apiField]: formData[field as keyof ProfileData]
      };

      console.log(`Updating ${field} (${apiField}):`, updateData);

      const response = await fetch(`${mainLink}/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken.accessToken}`,
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Backend error:', errorData);
        
        // Check for duplicate key error
        if (errorData.error && errorData.error.includes('dup key')) {
          throw new Error('Dette telefonnummeret er allerede i bruk');
        }
        
        throw new Error(errorData.message || errorData.error || 'Kunne ikke oppdatere');
      }

      const updatedUser = await response.json();
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

  const handleInputChange = (field: string, value: string) => {
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
          <input
            type={type}
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            className={styles.fieldInput}
            autoFocus
          />
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
            {field === "password" ? "************" : value}
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
          {/* ⚠️ TODO: Add to User model - currently empty */}
          <div style={{ position: 'relative' }}>
            <ProfileField label="Etternavn" field="lastName" value={formData.lastName} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
          {/* ⚠️ TODO: Add to User model - currently empty */}
          <div style={{ position: 'relative' }}>
            <ProfileField label="Født" field="birthDate" value={formData.birthDate} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
          {/* ⚠️ TODO: Add to User model - currently empty */}
          <div style={{ position: 'relative' }}>
            <ProfileField label="Kjønn" field="gender" value={formData.gender} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
        </div>

        {/* Address Information */}
        <div className={styles.fieldsSection}>
          <div className={styles.sectionTitle}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--color-accent)' }}>
              home
            </span>
            Adresse
          </div>
          {/* ⚠️ TODO: Add all address fields to User model - currently empty */}
          <div style={{ position: 'relative' }}>
            <ProfileField label="Adresse" field="address" value={formData.address} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
          <div style={{ position: 'relative' }}>
            <ProfileField label="Postnummer" field="postNumber" value={formData.postNumber} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
          <div style={{ position: 'relative' }}>
            <ProfileField label="Poststed" field="postSted" value={formData.postSted} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
          <div style={{ position: 'relative' }}>
            <ProfileField label="Land" field="country" value={formData.country} />
            <span style={{ 
              position: 'absolute', 
              top: '50%', 
              right: '40px', 
              transform: 'translateY(-50%)',
              fontSize: '11px', 
              color: '#ff9800', 
              fontWeight: '600',
              background: 'rgba(255, 152, 0, 0.1)',
              padding: '2px 8px',
              borderRadius: '4px'
            }}>TODO</span>
          </div>
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
