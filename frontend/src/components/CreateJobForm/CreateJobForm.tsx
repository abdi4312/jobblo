import { useState } from "react";
import ImageUpload from "../ImageUpload/ImageUpload";

interface CreateJobFormProps {
  onSubmit: (jobData: any) => void;
  userId: string;
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
  };
}

export default function CreateJobForm({ onSubmit, userId, initialData }: CreateJobFormProps) {
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);

  const handleImagesChange = (images: File[]) => {
    setSelectedImages(images);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const jobData: any = {
      userId,
      title,
      description,
      price: Number(price),
      location: {
        address,
        city,
        coordinates: [0, 0] // Placeholder for coordinates
      },
      categories: categories.split(',').map(cat => cat.trim()),
      urgent,
      fromDate,
      toDate,
    };

    // Only include equipment if it's filled
    if (equipment && equipment.trim() !== '') {
      jobData.equipment = equipment;
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
        <input
          type="text"
          value={categories}
          onChange={(e) => setCategories(e.target.value)}
          required
          placeholder="Flytting, Transport (kommaseparert)"
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
          Utstyr (valgfritt)
        </label>
        <select
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        >
          <option value="">Velg...</option>
          <option value="Ja">Ja, trengs utstyr</option>
          <option value="Nei">Nei, trengs ikke utstyr</option>
        </select>
      </div>

      <div style={{ marginBottom: "24px" }}>
        <label style={{ display: "block", marginBottom: "8px", fontWeight: "bold" }}>
          Fra dato *
        </label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          required
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
          style={{
            width: "90%",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--color-icon)",
          }}
        />
      </div>

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
