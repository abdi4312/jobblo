import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import { mainLink } from "../../api/mainURLs";

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
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  
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
        email: user.email || "",
        phoneNumber: user.phone || "",
        name: user.name || "",
        profileImage: user.avatarUrl || "",
      }));
    }
  }, [user]);

  const [editingField, setEditingField] = useState<string | null>(null);

  const handleEdit = (field: string) => {
    setEditingField(field);
  };

  const handleSave = async (field: string) => {
    if (!user?._id) {
      alert('User not logged in');
      return;
    }

    try {
      // Map form fields to API fields
      const fieldMapping: Record<string, string> = {
        phoneNumber: 'phone',
        name: 'name',
        email: 'email',
        // Add more mappings as needed
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
        
        throw new Error(errorData.error || 'Failed to update user');
      }

      const updatedUser = await response.json();
      console.log('Updated user:', updatedUser);
      
      // Update Zustand store with new data
      useUserStore.getState().setUser(updatedUser);
      
      alert('Oppdatert!');
      setEditingField(null);
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error instanceof Error ? error.message : 'Kunne ikke oppdatere');
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
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "16px 0",
      borderBottom: "1px solid #e0e0e0",
    }}>
      <span style={{ 
        fontWeight: "600", 
        fontSize: "16px",
        minWidth: "120px"
      }}>
        {label}
      </span>
      
      {editingField === field ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
          <input
            type={type}
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
            style={{
              flex: 1,
              padding: "8px",
              border: "1px solid var(--color-primary)",
              borderRadius: "4px",
              fontSize: "16px",
            }}
            autoFocus
          />
          <button
            onClick={() => handleSave(field)}
            style={{
              padding: "8px 16px",
              backgroundColor: "var(--color-primary)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Lagre
          </button>
        </div>
      ) : (
        <>
          <span style={{ 
            fontSize: "16px",
            color: "#666",
            flex: 1,
            textAlign: "right",
            marginRight: "12px"
          }}>
            {field === "password" ? "************" : value}
          </span>
          <span 
            className="material-symbols-outlined"
            onClick={() => handleEdit(field)}
            style={{
              fontSize: "20px",
              color: "var(--color-primary)",
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
    <div style={{ 
      padding: "0",
      maxWidth: "600px",
      margin: "0 auto",
      minHeight: "100vh"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        padding: "16px 20px",
        borderBottom: "1px solid #e0e0e0",
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "16px",
            color: "var(--color-text)",
          }}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Tilbake til Min Side
        </button>
      </div>

      {/* Title */}
      <h2 style={{
        textAlign: "center",
        margin: "20px 0",
        fontSize: "24px",
        fontWeight: "600"
      }}>
        Min profil
      </h2>

      {/* Profile Picture */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "40px",
        gap: "12px"
      }}>
        <div style={{
          width: "100px",
          height: "100px",
          borderRadius: "50%",
          overflow: "hidden",
          border: "3px solid var(--color-primary)",
          backgroundColor: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          {formData.profileImage ? (
            <img 
              src={formData.profileImage} 
              alt="Profile"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover"
              }}
            />
          ) : (
            <span style={{ fontSize: "40px", color: "var(--color-primary)" }}>
              {formData.name ? formData.name.charAt(0).toUpperCase() : "?"}
            </span>
          )}
        </div>
        <button
          style={{
            padding: "8px 20px",
            backgroundColor: "transparent",
            color: "var(--color-primary)",
            border: "1px solid var(--color-primary)",
            borderRadius: "20px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Endre bilde
        </button>
      </div>

      {/* User Stats */}
      {user && (
        <div style={{ padding: "0 20px", marginBottom: "20px" }}>
          <div style={{ 
            backgroundColor: "var(--color-surface)", 
            borderRadius: "12px", 
            padding: "16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px"
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--color-primary)" }}>
                {user.averageRating || 0}⭐
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text)" }}>Rating</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--color-primary)" }}>
                {user.reviewCount || 0}
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text)" }}>Anmeldelser</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--color-accent)" }}>
                {user.earnings || 0} kr
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text)" }}>Tjent</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px", fontWeight: "bold", color: "var(--color-accent)" }}>
                {user.spending || 0} kr
              </div>
              <div style={{ fontSize: "12px", color: "var(--color-text)" }}>Brukt</div>
            </div>
          </div>
          {user.bio && (
            <div style={{ marginTop: "12px", padding: "12px", backgroundColor: "var(--color-surface)", borderRadius: "8px" }}>
              <strong>Bio:</strong> {user.bio}
            </div>
          )}
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <span style={{ 
              padding: "4px 12px", 
              backgroundColor: "var(--color-primary)", 
              color: "white", 
              borderRadius: "12px",
              fontSize: "12px"
            }}>
              {user.role}
            </span>
            <span style={{ 
              padding: "4px 12px", 
              backgroundColor: "var(--color-accent)", 
              color: "white", 
              borderRadius: "12px",
              fontSize: "12px"
            }}>
              {user.subscription}
            </span>
          </div>
        </div>
      )}

      {/* Profile Fields */}
      <div style={{ padding: "0 20px" }}>
        <ProfileField label="Epost" field="email" value={formData.email} type="email" />
        <ProfileField label="Passord" field="password" value={formData.password} type="password" />
        <ProfileField label="Mobil" field="phoneNumber" value={formData.phoneNumber} type="tel" />
        
        <div style={{ height: "20px" }} />
        
        <ProfileField label="Fornavn" field="name" value={formData.name} />
        <ProfileField label="Etternavn" field="lastName" value={formData.lastName} />
        <ProfileField label="Født" field="birthDate" value={formData.birthDate} />
        <ProfileField label="Kjønn" field="gender" value={formData.gender} />
        
        <div style={{ height: "20px" }} />
        
        <ProfileField label="Adresse" field="address" value={formData.address} />
        <ProfileField label="Postnummer" field="postNumber" value={formData.postNumber} />
        <ProfileField label="Poststed" field="postSted" value={formData.postSted} />
        <ProfileField label="Land" field="country" value={formData.country} />
      </div>
    </div>
  );
}
