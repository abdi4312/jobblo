import { useState, useEffect } from "react";
import ImageUpload from "../ImageUpload/ImageUpload";
import { mainLink } from "../../api/mainURLs";
import "./CreateJobForm.css"

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
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");


  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${mainLink}/api/categories`);
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.map((cat: any) => cat.name || cat));
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    
    fetchCategories();
  }, []);

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
        coordinates: [10.7461, 59.9127] // Default Oslo coordinates
      },
      categories: categories.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0),
      urgent,
    };

    // Only include userId when creating a new job (not editing)
    if (!isEditMode && userId) {
      jobData.userId = userId;
    }

    // Equipment is now required
    jobData.equipment = equipment;

    // Only include dates if they're filled
    if (fromDate) {
      jobData.fromDate = fromDate;
    }
    if (toDate) {
      jobData.toDate = toDate;
    }

    // Include duration if value is provided
    if (durationValue && Number(durationValue) > 0) {
      jobData.duration = {
        value: Number(durationValue),
        unit: durationUnit
      };
    }

    // TODO: Uncomment when backend is ready to accept File objects
    // jobData.images = selectedImages;

    onSubmit(jobData);
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "800px", margin: "auto", paddingBottom: "80px" }}>
      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Bilder *
        </label>
        <ImageUpload onImagesChange={handleImagesChange} />
      </div>
      

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Tittel *
        </label>
        <input
          type="text"
          value={title}
          className="text-input"
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="F.eks. Flyttehjelp ønskes"
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Beskrivelse *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          className="text-input"
          rows={5}
          placeholder="Beskriv oppdraget i detalj..."
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
            resize: "vertical",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Pris (NOK) *
        </label>
        <input
          type="number"
          value={price}
          className="text-input"
          onChange={(e) => setPrice(e.target.value)}
          required
          placeholder="2000"
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Adresse *
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          className="text-input"
          placeholder="Dronningens gate 10"
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          By *
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          required
          className="text-input"
          placeholder="Trondheim"
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        />
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Kategorier *
        </label>
        <select
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          required
          className="text-input"
          size={1}
          style={{
            width: "calc(90% + 24px)",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
            fontSize: "16px",
            fontFamily: "inherit",
            color: "var(--color-text)",
            cursor: "pointer",
            maxHeight: "200px",
            overflow: "auto",
          }}
        >
          <option value="">Velg kategori...</option>
          {availableCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Utstyr
        </label>
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          size={1}
          required
          className="text-input"
          style={{
            width: "calc(90% + 24px)",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
            fontSize: "16px",
            fontFamily: "inherit",
            color: "var(--color-text)",
            cursor: "pointer",
            maxHeight: "200px",
            overflow: "auto",
          }}
        >
          <option value="">Velg...</option>
          <option value="utstyrfri">Utstyrfri</option>
          <option value="delvis utstyr">Delvis utstyr</option>
          <option value="trengs utstyr">Trengs utstyr</option>
        </select>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Varighet
        </label>
        <div style={{ display: "flex", gap: "12px", maxWidth: "93.5%", }}>
          <input
            type="number"
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value)}
            className="text-input"
            min="0"
            step="0.5"
            placeholder="2"
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--color-icon)",
            }}
          />
          <select
            value={durationUnit}
            onChange={(e) => {setDurationUnit(e.target.value);
              if (e.target.value !== "days") setToDate("");
            }}
            className="text-input"
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--color-icon)",
            }}
          >
            <option value="minutes">Minutter</option>
            <option value="hours">Timer</option>
            <option value="days">Dager</option>
          </select>
        </div>
      </div>
      {durationUnit === "days" ? (   //TIl og fra dato vises kun hvis varighet er i dager    
      <>
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            Fra dato *
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
            className="text-input"
            style={{
              width: "90%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--color-icon)",
            }}
          />
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
            Til dato *
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
            className="text-input"
            style={{
              width: "90%",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid var(--color-icon)",
            }}
          />
        </div>
      </>
      ):(

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Dato*
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          required
          className="text-input"
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        />
      </div> )}

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
            style={{ width: "20px", height: "20px" }}
          />
          <span style={{ fontWeight: "bold", color: "var(--color-icon)" }}>Haster?</span>
        </label>
      </div>

      <button
        type="submit"
        style={{
          padding: "12px 24px",
          backgroundColor: "var(--color-primary)",
          color: "white",
          border: "var(--color-icon)",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "16px",
        }}
      >
        {initialData ? "Oppdater oppdrag" : "Publiser oppdrag"}
      </button>
    </form>
  );
}
