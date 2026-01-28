import { useState, useEffect } from "react";

// Working ImageUpload component
const ImageUpload = ({ onImagesChange }: { onImagesChange: (files: File[]) => void }) => {
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onImagesChange(files);
    
    // Create preview URLs
    const previewUrls = files.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  };

  const handleClick = () => {
    const input = document.getElementById('file-upload') as HTMLInputElement;
    input?.click();
  };

  return (
    <div>
      <input
        id="file-upload"
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div 
        onClick={handleClick}
        style={{
          border: "2px dashed #ddd",
          borderRadius: "12px",
          padding: "40px 20px",
          textAlign: "center",
          backgroundColor: "#f9f9f9",
          cursor: "pointer",
          transition: "all 0.3s ease"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#4CAF50";
          e.currentTarget.style.backgroundColor = "#f0f9f0";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#ddd";
          e.currentTarget.style.backgroundColor = "#f9f9f9";
        }}>
        <p style={{ margin: 0, color: "#666", fontSize: "16px" }}>📸 Last opp bilder</p>
        <p style={{ margin: "8px 0 0 0", color: "#999", fontSize: "13px" }}>
          Klikk for å velge bilder
        </p>
      </div>
      
      {previews.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: "12px",
          marginTop: "16px"
        }}>
          {previews.map((preview, index) => (
            <div key={index} style={{
              position: "relative",
              paddingTop: "100%",
              borderRadius: "8px",
              overflow: "hidden",
              border: "2px solid #e0e0e0"
            }}>
              <img 
                src={preview} 
                alt={`Preview ${index + 1}`}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover"
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface CreateJobFormProps {
  onSubmit: (jobData: any) => void;
  userId?: string;
  initialData?: {
    title?: string;
    description?: string;
    price?: string;
    address?: string;
    city?: string;
    categories?: string;
    urgent?: boolean;
    equipment?: string;
    fromDate?: string;
    toDate?: string;
    durationValue?: string;
    durationUnit?: string;
  };
  isEditMode?: boolean;
}

export default function CreateJobForm({ onSubmit, userId, initialData, isEditMode = false }: CreateJobFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [price, setPrice] = useState(initialData?.price || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [categories, setCategories] = useState(initialData?.categories || "");
  const [urgent, setUrgent] = useState(initialData?.urgent || false);
  const [equipment, setEquipment] = useState(initialData?.equipment || "");
  const [fromDate, setFromDate] = useState(initialData?.fromDate || "");
  const [toDate, setToDate] = useState(initialData?.toDate || "");
  const [durationValue, setDurationValue] = useState(initialData?.durationValue || "");
  const [durationUnit, setDurationUnit] = useState(initialData?.durationUnit || "hours");
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [availableCategories] = useState<string[]>(["Flytting", "Rengjøring", "Maling", "Hagearbeid", "Transport"]);

  const handleImagesChange = (images: File[]) => {
    setSelectedImages(images);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const jobData: any = {
      title,
      description,
      price: Number(price),
      location: {
        type: 'Point',
        address,
        city,
        coordinates: [10.7461, 59.9127]
      },
      categories: categories.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0),
      urgent,
    };

    if (!isEditMode && userId) {
      jobData.userId = userId;
    }

    jobData.equipment = equipment;

    if (fromDate) {
      jobData.fromDate = fromDate;
    }
    if (toDate) {
      jobData.toDate = toDate;
    }

    if (durationValue && Number(durationValue) > 0) {
      jobData.duration = {
        value: Number(durationValue),
        unit: durationUnit
      };
    }

    onSubmit(jobData);
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "20px",
    paddingBottom: "100px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
  };

  const fieldStyle: React.CSSProperties = {
    marginBottom: "24px"
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: "8px",
    fontWeight: "600",
    fontSize: "15px",
    color: "#2c3e50"
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    fontFamily: "inherit",
    fontSize: "16px",
    border: "2px solid #e0e0e0",
    outline: "none",
    transition: "all 0.3s ease",
    boxSizing: "border-box",
    backgroundColor: "#fff"
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer",
    appearance: "none",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M6 9L1 4h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 16px center",
    paddingRight: "40px"
  };

  const textareaStyle: React.CSSProperties = {
    ...inputStyle,
    resize: "vertical",
    minHeight: "120px"
  };

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    padding: "16px 24px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "12px",
    cursor: "pointer",
    fontSize: "17px",
    fontWeight: "600",
    transition: "all 0.3s ease",
    boxShadow: "0 4px 12px rgba(76, 175, 80, 0.3)"
  };

  return (
    <div style={containerStyle}>
      <style>{`
        input:focus, select:focus, textarea:focus {
          border-color: #4CAF50 !important;
          box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
        }
        
        button:hover {
          background-color: #45a049 !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(76, 175, 80, 0.4) !important;
        }
        
        button:active {
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          input, select, textarea {
            font-size: 16px !important;
          }
        }
      `}</style>

      <div>
        <div style={fieldStyle}>
          <label style={labelStyle}>
            📸 Bilder *
          </label>
          <ImageUpload onImagesChange={handleImagesChange} />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            📝 Tittel *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="F.eks. Flyttehjelp ønskes"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            📄 Beskrivelse *
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Beskriv oppdraget i detalj..."
            style={textareaStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            💰 Pris (NOK) *
          </label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            placeholder="2000"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            📍 Adresse *
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="Dronningens gate 10"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            🏙️ By *
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            placeholder="Trondheim"
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            🏷️ Kategorier *
          </label>
          <select
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            required
            style={selectStyle}
          >
            <option value="">Velg kategori...</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            🔧 Utstyr *
          </label>
          <select
            value={equipment}
            onChange={(e) => setEquipment(e.target.value)}
            required
            style={selectStyle}
          >
            <option value="">Velg...</option>
            <option value="utstyrfri">Utstyrfri</option>
            <option value="delvis utstyr">Delvis utstyr</option>
            <option value="trengs utstyr">Trengs utstyr</option>
          </select>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            ⏱️ Varighet
          </label>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <input
              type="number"
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              min="0"
              step="0.5"
              placeholder="2"
              style={{ ...inputStyle, flex: "1", minWidth: "120px" }}
            />
            <select
              value={durationUnit}
              onChange={(e) => setDurationUnit(e.target.value)}
              style={{ ...selectStyle, flex: "1", minWidth: "120px" }}
            >
              <option value="minutes">Minutter</option>
              <option value="hours">Timer</option>
              <option value="days">Dager</option>
            </select>
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            📅 Fra dato *
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>
            📅 Til dato *
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ ...fieldStyle, backgroundColor: "#fff3cd", padding: "16px", borderRadius: "12px", border: "2px solid #ffc107" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", margin: 0 }}>
            <input
              type="checkbox"
              checked={urgent}
              onChange={(e) => setUrgent(e.target.checked)}
              style={{ 
                width: "24px", 
                height: "24px", 
                cursor: "pointer",
                accentColor: "#ff9800"
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "600", color: "#f57c00", fontSize: "16px" }}>
                ⚡ Haster?
              </div>
              <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
                20 kr - Lås opp øyeblikkelig kontakt for alle brukere (hopper over ventetiden)
              </div>
            </div>
          </label>
        </div>

        <button onClick={handleSubmit} type="button" style={buttonStyle}>
          {initialData ? "✅ Oppdater oppdrag" : "🚀 Publiser oppdrag"}
        </button>
      </div>
    </div>
  );
}