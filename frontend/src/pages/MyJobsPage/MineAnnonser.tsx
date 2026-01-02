import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import mainLink from "../../api/mainURLs";
import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import {
  deleteService,
  getMyPostedServices,
  updateService,
} from "../../api/servicesAPI.ts";
import axios from "axios";

interface Location {
  coordinates: [number, number];
  address: string;
  city: string;
  type: string;
}

interface Duration {
  value: number;
  unit: string;
}

interface UserId {
  _id: string;
  name: string;
  email: string;
}

interface Service {
  _id: string;
  userId: UserId;
  title: string;
  description: string;
  price: number;
  location: Location;
  categories: string[];
  images: string[];
  urgent: boolean;
  status: string;
  tags: string[];
  equipment: string;
  imageMetadata: any[];
  timeEntries: any[];
  duration: Duration;
  fromDate?: string;
  toDate?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export default function MineAnnonser() {
  const navigate = useNavigate();
  const userToken = useUserStore((state) => state.tokens);

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchMyServices();
  }, []);

  const fetchMyServices = async () => {
    if (!userToken?.accessToken) {
      setError("Du må være logget inn for å se dine annonser");
      setLoading(false);
      return;
    }

    try {
      const data = await getMyPostedServices();
      setServices(data);
      setError(null);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Error fetching services:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm("Er du sikker på at du vil slette denne annonsen?")) {
      return;
    }

    try {
      await deleteService(serviceId);
      alert("Annonse slettet!");
      void fetchMyServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : "Det oppstod en feil";
      alert(message || "Kunne ikke slette annonse");
    }
  };

  const handleFormSubmit = async (jobData: any) => {
    // ... existing code ...
    try {
      await updateService(editingService!._id, jobData);
      alert("Oppdrag oppdatert!");
      setEditingService(null);
      void fetchMyServices();
    } catch (error) {
      console.error("Failed to update job:", error);
      let message = "Det oppstod en feil ved oppdatering";
      if (axios.isAxiosError(error)) {
        message =
          error.response?.data?.error ||
          error.response?.data?.message ||
          message;
      }
      alert(`Kunne ikke oppdatere oppdrag: ${message}`);
    }
  };

  if (editingService) {
    return (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "20px",
          }}
        >
          <button
            onClick={() => setEditingService(null)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "32px" }}
            >
              arrow_left
            </span>
          </button>
          <h2 style={{ margin: 0 }}>Rediger Oppdrag</h2>
        </div>

        <div
          style={{
            height: "2px",
            width: "90vw",
            backgroundColor: "var(--color-muted-gray)",
            margin: "auto",
          }}
        ></div>

        <div
          style={{
            padding: "20px",
            maxWidth: "900px",
            margin: "auto",
            paddingBottom: "80px",
          }}
        >
          <CreateJobForm
            onSubmit={handleFormSubmit}
            isEditMode={true}
            initialData={{
              title: editingService.title,
              description: editingService.description,
              price: editingService.price.toString(),
              address: editingService.location.address,
              city: editingService.location.city,
              categories: editingService.categories.join(", "),
              urgent: editingService.urgent,
              equipment: editingService.equipment || "",
              fromDate: editingService.fromDate
                ? new Date(editingService.fromDate).toISOString().split("T")[0]
                : "",
              toDate: editingService.toDate
                ? new Date(editingService.toDate).toISOString().split("T")[0]
                : "",
              durationValue: editingService.duration?.value?.toString() || "",
              durationUnit: editingService.duration?.unit || "hours",
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        padding: "0",
        maxWidth: "900px",
        margin: "0 auto",
        minHeight: "100vh",
      }}
    >
      <ProfileTitleWrapper title="Mine Annonser" buttonText="Tilbake" />

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px" }}>Laster...</div>
      ) : error ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "red",
            backgroundColor: "#ffe6e6",
            margin: "20px",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      ) : services.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--color-icon)",
          }}
        >
          Du har ingen annonser ennå
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "20px",
            padding: "20px",
          }}
        >
          {services.map((service) => (
            <div
              key={service._id}
              onClick={() => navigate(`/job-listing/${service._id}`)}
              style={{
                borderRadius: "16px",
                backgroundColor: "var(--color-surface)",
                boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                position: "relative",
                cursor: "pointer",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
              }}
            >
              {/* Image Section */}
              <div
                style={{
                  width: "100%",
                  height: "150px",
                  borderRadius: "16px 16px 0 0",
                  backgroundColor: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                {service.images && service.images[0] ? (
                  <img
                    src={service.images[0]}
                    alt={service.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: "16px 16px 0 0",
                    }}
                  />
                ) : (
                  <span style={{ color: "#666", fontSize: "16px" }}>
                    Ingen bilde
                  </span>
                )}

                {/* Status Badge */}
                {service.urgent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      background: "#ff4444",
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}
                  >
                    ⚡ Haster
                  </div>
                )}
              </div>

              {/* Title */}
              <h3
                style={{
                  marginLeft: "12px",
                  marginBottom: "4px",
                  marginTop: "12px",
                  color: "var(--color-text)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {service.title}
              </h3>

              {/* Categories & Equipment */}
              <div
                style={{
                  display: "flex",
                  fontSize: "14px",
                  gap: "8px",
                  padding: "0 12px",
                  flexWrap: "wrap",
                }}
              >
                {service.categories.map((cat, index) => (
                  <h4
                    key={index}
                    style={{
                      padding: "2px 8px",
                      backgroundColor: "var(--color-accent)",
                      color: "var(--color-white)",
                      margin: "0",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}
                  >
                    {cat}
                  </h4>
                ))}

                {service.equipment && (
                  <h4
                    style={{
                      padding: "2px 8px",
                      backgroundColor:
                        service.equipment === "utstyrfri"
                          ? "#22c55e"
                          : service.equipment === "delvis utstyr"
                            ? "#ea7e15"
                            : "#6b7280",
                      color: "white",
                      margin: "0",
                      borderRadius: "4px",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {service.equipment === "utstyrfri"
                      ? "Utstyrfri"
                      : service.equipment === "delvis utstyr"
                        ? "Noe utstyr"
                        : "Utstyr kreves"}
                  </h4>
                )}
              </div>

              {/* Job Details */}
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "lighter",
                  padding: "8px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "18px" }}
                  >
                    location_on
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {service.location.address}, {service.location.city}
                  </h3>
                </div>

                {service.duration && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "18px" }}
                    >
                      schedule
                    </span>
                    <h3 style={{ margin: 0, fontSize: "14px" }}>
                      {service.duration.value
                        ? `${service.duration.value} ${service.duration.unit}`
                        : "Ikke angitt"}
                    </h3>
                  </div>
                )}

                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "18px" }}
                  >
                    info
                  </span>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      color: service.status === "open" ? "#22c55e" : "#ea7e15",
                      fontWeight: "bold",
                    }}
                  >
                    {service.status === "open" ? "Aktiv" : service.status}
                  </h3>
                </div>
              </div>

              {/* Price */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  width: "80%",
                  marginTop: "8px",
                  marginLeft: "auto",
                  marginRight: "auto",
                  padding: "8px 0",
                  backgroundColor: "var(--color-muted-gray)",
                  borderRadius: "10px",
                }}
              >
                <span
                  style={{
                    fontWeight: 900,
                    color: "var(--color-price)",
                    fontSize: "17px",
                  }}
                >
                  {service.price}kr
                </span>
              </div>

              {/* Action Buttons */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "12px",
                  borderTop: "1px solid #e0e0e0",
                  marginTop: "12px",
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(service);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    backgroundColor: "var(--color-primary)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "18px" }}
                  >
                    edit
                  </span>
                  Rediger
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(service._id);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    backgroundColor: "#ff4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "500",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "18px" }}
                  >
                    delete
                  </span>
                  Slett
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
