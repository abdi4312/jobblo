import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const [formData, setFormData] = useState<ProfileData>({
    email: "olanormannen@theman.com",
    password: "************",
    phoneNumber: "645 23 452",
    name: "Ola",
    lastName: "Normann",
    birthDate: "1832",
    gender: "Mann",
    address: "Ola gate 23",
    postNumber: "1337",
    postSted: "Sandvika",
    country: "Norge",
    profileImage: "https://via.placeholder.com/100",
  });

  const [editingField, setEditingField] = useState<string | null>(null);

  const handleEdit = (field: string) => {
    setEditingField(field);
  };

  const handleSave = async (field: string) => {
    console.log(`Saving ${field}:`, formData[field as keyof ProfileData]);
    setEditingField(null);
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
        }}>
          <img 
            src={formData.profileImage} 
            alt="Profile"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
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
