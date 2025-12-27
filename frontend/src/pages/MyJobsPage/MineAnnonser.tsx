import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import { mainLink } from "../../api/mainURLs";
import CreateJobForm from "../../components/CreateJobForm/CreateJobForm";

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
    fetchMyServices();
  }, []);

  const fetchMyServices = async () => {
    if (!userToken?.accessToken) {
      setError('Du må være logget inn for å se dine annonser');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${mainLink}/api/services/my-posted`, {
        headers: {
          'Authorization': `Bearer ${userToken.accessToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setServices(data);
        setError(null);
      } else {
        const errorData = await response.json();
        console.error('Failed to fetch services:', errorData);
        setError(errorData.message || 'Kunne ikke hente annonser');
      }
    } catch (error) {
      console.error('Error fetching services:', error);
      setError('Kunne ikke koble til serveren. Sjekk at backend kjører på http://localhost:5000');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
  };

  const handleDelete = async (serviceId: string) => {
    if (!confirm('Er du sikker på at du vil slette denne annonsen?')) {
      return;
    }

    try {
      const response = await fetch(`${mainLink}/api/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken?.accessToken}`,
        },
      });
      
      if (response.ok) {
        alert('Annonse slettet!');
        fetchMyServices(); // Refresh the list
      } else {
        alert('Kunne ikke slette annonse');
      }
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Det oppstod en feil');
    }
  };

  const handleFormSubmit = async (jobData: any) => {
    try {
      const response = await fetch(`${mainLink}/api/services/${editingService!._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken?.accessToken}`,
        },
        body: JSON.stringify(jobData),
      });
      
      if (response.ok) {
        alert('Oppdrag oppdatert!');
        setEditingService(null);
        fetchMyServices(); // Refresh the list
      } else {
        alert('Kunne ikke oppdatere oppdrag');
      }
    } catch (error) {
      console.error('Error updating job:', error);
      alert('Det oppstod en feil');
    }
  };

  if (editingService) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px' }}>
          <button
            onClick={() => setEditingService(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>
              arrow_left
            </span>
          </button>
          <h2 style={{ margin: 0 }}>Rediger Oppdrag</h2>
        </div>

        <div style={{height:"2px", width:"90vw", backgroundColor:"var(--color-muted-gray)", margin:"auto"}}></div>

        <div style={{ padding: "20px", maxWidth:"900px", margin:"auto", paddingBottom:"80px" }}>
          <CreateJobForm 
            onSubmit={handleFormSubmit} 
            userId={editingService.userId._id}
            initialData={{
              title: editingService.title,
              description: editingService.description,
              price: editingService.price.toString(),
              address: editingService.location.address,
              city: editingService.location.city,
              categories: editingService.categories.join(', '),
              urgent: editingService.urgent,
              equipment: editingService.equipment,
            }}
          />
        </div>
      </>
    );
  }

  return (
    <div style={{ 
      padding: "0",
      maxWidth: "900px",
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
          Tilbake
        </button>
      </div>

      {/* Title */}
      <h2 style={{
        textAlign: "center",
        margin: "20px 0",
        fontSize: "24px",
        fontWeight: "600"
      }}>
        Mine Annonser
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Laster...</div>
      ) : error ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: 'red',
          backgroundColor: '#ffe6e6',
          margin: '20px',
          borderRadius: '8px'
        }}>
          {error}
        </div>
      ) : services.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-icon)' }}>
          Du har ingen annonser ennå
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          {services.map((service) => (
            <div
              key={service._id}
              style={{
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                backgroundColor: 'white',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 10px 0', fontSize: '20px' }}>{service.title}</h3>
                  <p style={{ margin: '0 0 10px 0', color: 'var(--color-icon)' }}>
                    {service.description}
                  </p>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {service.price} NOK
                    </span>
                    <span style={{ color: 'var(--color-icon)' }}>
                      📍 {service.location.city}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {service.categories.map((cat, index) => (
                      <span
                        key={index}
                        style={{
                          backgroundColor: 'var(--color-background)',
                          padding: '4px 12px',
                          borderRadius: '16px',
                          fontSize: '14px',
                        }}
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--color-icon)' }}>
                    Status: <span style={{ 
                      color: service.status === 'open' ? 'green' : 'orange',
                      fontWeight: 'bold'
                    }}>{service.status}</span>
                    {service.urgent && (
                      <span style={{ marginLeft: '10px', color: 'red', fontWeight: 'bold' }}>
                        ⚡ Haster
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px' }}>
                  <button
                    onClick={() => handleEdit(service)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    ✏️ Rediger
                  </button>
                  <button
                    onClick={() => handleDelete(service._id)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    🗑️ Slett
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
