import { useEffect, useState } from "react";
import { getFavorites, deleteFavorites } from "../../api/favoriteAPI.ts";
import { useUserStore } from "../../stores/userStore.ts";
import type { FavoritesResponse } from "../../types/FavoritesTypes.ts";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoritesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const userToken = useUserStore((state) => state.tokens);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFavorites();
  }, [userToken]);

  const fetchFavorites = async () => {
    try {
      const data = await getFavorites(userToken);
      setFavorites(data);
    } catch (err) {
      console.error("Failed to fetch favorites", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteFavorites(serviceId, userToken);
      toast.success("Fjernet fra favoritter");
      fetchFavorites(); // Refresh the list
    } catch (err) {
      console.error("Failed to remove favorite", err);
      toast.error("Kunne ikke fjerne favoritt");
    }
  };

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
        Mine Favoritter
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Laster...</div>
      ) : !favorites?.data || favorites.data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-icon)' }}>
          Du har ingen favoritter ennå
        </div>
      ) : (
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          padding: '20px',
        }}>
          {favorites.data.map((favorite) => {
            const service = favorite.service;
            return (
              <div
                key={favorite._id}
                onClick={() => navigate(`/job-listing/${service._id}`)}
                style={{ 
                  borderRadius: "16px", 
                  backgroundColor: "var(--color-surface)",
                  boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                }}
              >
                {/* Image Section */}
                <div style={{ 
                  width: "100%", 
                  height: "150px", 
                  borderRadius: "16px 16px 0 0",
                  backgroundColor: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}>
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
                    <div style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      background: "#ff4444",
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: "bold",
                    }}>
                      ⚡ Haster
                    </div>
                  )}
                </div>

                {/* Title */}
                <h3 style={{ 
                  marginLeft: "12px", 
                  marginBottom: "4px", 
                  marginTop: "12px",
                  color: "var(--color-text)", 
                  whiteSpace: "nowrap", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis" 
                }}>
                  {service.title}
                </h3>

                {/* Categories & Equipment */}
                <div style={{ display: "flex", fontSize: "14px", gap: "8px", padding: "0 12px", flexWrap: "wrap" }}>
                  {service.categories?.map((cat, index) => (
                    <h4 key={index} style={{ 
                      padding: "2px 8px",
                      backgroundColor: "var(--color-accent)",
                      color: "var(--color-white)",
                      margin: "0", 
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}>
                      {cat}
                    </h4>
                  ))}
                  
                  {service.equipment && (
                    <h4 style={{
                      padding: "2px 8px",
                      backgroundColor: 
                        service.equipment === 'utstyrfri' ? '#22c55e' : 
                        service.equipment === 'delvis utstyr' ? '#ea7e15' : 
                        '#6b7280',
                      color: "white",
                      margin: "0", 
                      borderRadius: "4px",
                      fontSize: "12px",
                      whiteSpace: "nowrap"
                    }}>
                      {service.equipment === 'utstyrfri' ? 'Utstyrfri' :
                       service.equipment === 'delvis utstyr' ? 'Noe utstyr' :
                       'Utstyr kreves'}
                    </h4>
                  )}
                </div>

                {/* Job Details */}
                <div style={{ fontSize: "14px", fontWeight: "lighter", padding: "8px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                    <span className='material-symbols-outlined' style={{ fontSize: "18px" }}>location_on</span>
                    <h3 style={{ margin: 0, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {service.location?.address}{(service.location as any)?.city ? `, ${(service.location as any).city}` : ''}
                    </h3>
                  </div>

                  {service.duration && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                      <span className='material-symbols-outlined' style={{ fontSize: "18px" }}>schedule</span>
                      <h3 style={{ margin: 0, fontSize: "14px" }}>
                        {(service.duration as any).value || ''} {service.duration.unit}
                      </h3>
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span className='material-symbols-outlined' style={{ fontSize: "18px" }}>info</span>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: "14px",
                      color: service.status === 'open' ? '#22c55e' : '#ea7e15',
                      fontWeight: 'bold'
                    }}>
                      {service.status === 'open' ? 'Aktiv' : service.status}
                    </h3>
                  </div>
                </div>

                {/* Price */}
                <div style={{ 
                  display: "flex", 
                  justifyContent: "center", 
                  width: "80%", 
                  marginTop: "8px", 
                  marginLeft: "auto",
                  marginRight: "auto",
                  padding: "8px 0",
                  backgroundColor: "var(--color-muted-gray)",
                  borderRadius: "10px",
                }}>
                  <span style={{ 
                    fontWeight: 900, 
                    color: "var(--color-price)",
                    fontSize: "17px"
                  }}>
                    {service.price}kr
                  </span>
                </div>

                {/* Action Button */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  padding: '12px',
                  borderTop: '1px solid #e0e0e0',
                  marginTop: '12px'
                }}>
                  <button
                    onClick={(e) => handleRemoveFavorite(service._id, e)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>heart_broken</span>
                    Fjern favoritt
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
