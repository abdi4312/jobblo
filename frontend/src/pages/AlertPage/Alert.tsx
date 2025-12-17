import { useState, useEffect } from "react";
import { mainLink } from "../../api/mainURLs";
import { useUserStore } from "../../stores/userStore";

interface Alert {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  type: string;
  content: string;
  read: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function Alert() {
  const [activeTab, setActiveTab] = useState('nyheter');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  // Get user ID from Zustand store
  const user = useUserStore((state) => state.user);
  const userId = user?._id;
  
  const tabs = [
    { id: 'nyheter', label: 'Nyheter' },
    { id: 'lagrede', label: 'Lagrede' }
  ];

  useEffect(() => {
    const fetchAlerts = async () => {
      console.log('User:', user);
      console.log('User ID:', userId);
      
      if (!userId) {
        console.log('No user logged in');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        console.log('Fetching alerts for user:', userId);
        const response = await fetch(`${mainLink}/api/notifications?userId=${userId}`);
        
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error:', errorText);
          throw new Error('Failed to fetch');
        }
        
        const data = await response.json();
        console.log('Alerts data:', data);
        setAlerts(data);
      } catch (error) {
        console.error('Error fetching:', error);
        alert('Kunne ikke hente varsler');
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [userId]);

  // Show unread notifications in "nyheter" tab
  const nyheter = alerts.filter(alert => !alert.read);
  
  // Show read notifications in "lagrede" tab
  const lagrede = alerts.filter(alert => alert.read);

  return (
    <>
      <div style={{ padding: "20px 30px" }}>
        <h2 style={{ marginBottom: "20px" }}>Varslinger</h2>

        {/* Tab Headers */}
        <div style={{
          backgroundColor: "var(--color-surface)",
          display: "flex",
          justifyContent: "space-around",
          borderRadius: '16px',
          marginBottom: '20px',
        }}>
          {tabs.map(tab => (
            <h4
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                cursor: 'pointer',
                color: activeTab === tab.id ? "var(--color-white)" : "var(--color-text)",
                backgroundColor: activeTab === tab.id ? "var(--color-primary)" : "var(--color-surface)",
                padding: '10px 20px',
                borderRadius: '8px',
                margin: '8px',
                flex: 1,
                textAlign: 'center',
              }}
            >
              {tab.label}
            </h4>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'nyheter' && (
          <div>
            {loading ? (
              <p>Laster varsler...</p>
            ) : nyheter.length === 0 ? (
              <p>Ingen nyheter ennå</p>
            ) : (
              nyheter.map(alert => (
                <div 
                  key={alert._id} 
                  style={{
                    backgroundColor: alert.read ? 'var(--color-surface)' : 'var(--color-white)',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                    border: alert.read ? 'none' : '2px solid var(--color-muted-gray)',
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px' 
                  }}>
                    <strong>{alert.userId.name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--color-icon)' }}>
                      {new Date(alert.createdAt).toLocaleDateString('no-NO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{alert.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'lagrede' && (
          <div>
            {loading ? (
              <p>Laster lagrede varsler...</p>
            ) : lagrede.length === 0 ? (
              <p>Ingen lagrede varsler</p>
            ) : (
              lagrede.map(alert => (
                <div 
                  key={alert._id} 
                  style={{
                    backgroundColor: 'var(--color-surface)',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '8px' 
                  }}>
                    <strong>{alert.userId.name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--color-muted-gray)' }}>
                      {new Date(alert.createdAt).toLocaleDateString('no-NO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{alert.content}</p>
                  <span style={{ 
                    fontSize: '11px', 
                    color: 'var(--color-primary)',
                    fontWeight: 'bold' 
                  }}>
                    {alert.type}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
