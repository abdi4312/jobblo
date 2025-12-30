import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./MessagesPage.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";

interface Conversation {
  _id: string;
  participants: Array<{
    _id: string;
    name: string;
    profileImage?: string;
  }>;
  lastMessage: string;
  orderId: {
    _id: string;
    serviceId: {
      title: string;
    };
    customerId: string;
    providerId: string;
  };
  unreadCount?: number;
  updatedAt: string;
}

type FilterType = "Alle" | "Oppdrag" | "Forespørsel";

// Dummy data for UI preview
const DUMMY_CONVERSATIONS: Conversation[] = [
  {
    _id: "1",
    participants: [
      { _id: "user1", name: "Ole Hansen" },
      { _id: "user2", name: "Kari Nordmann" }
    ],
    lastMessage: "Hei! Når passer det for deg å starte?",
    orderId: {
      _id: "order1",
      serviceId: { title: "Snømåking - Oslo sentrum" },
      customerId: "user1",
      providerId: "user2"
    },
    unreadCount: 2,
    updatedAt: new Date().toISOString()
  },
  {
    _id: "2",
    participants: [
      { _id: "user1", name: "Ole Hansen" },
      { _id: "user3", name: "Per Olsen", profileImage: "https://i.pravatar.cc/150?img=3" }
    ],
    lastMessage: "Takk for jobben! Alt er ferdig.",
    orderId: {
      _id: "order2",
      serviceId: { title: "Maling av stue" },
      customerId: "user3",
      providerId: "user1"
    },
    updatedAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    _id: "3",
    participants: [
      { _id: "user1", name: "Ole Hansen" },
      { _id: "user4", name: "Lisa Berg" }
    ],
    lastMessage: "Kan vi avtale tid neste uke?",
    orderId: {
      _id: "order3",
      serviceId: { title: "Flyttehjelp - 3 roms leilighet" },
      customerId: "user1",
      providerId: "user4"
    },
    unreadCount: 1,
    updatedAt: new Date(Date.now() - 172800000).toISOString()
  }
];

export function MessagesPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterType>("Alle");
  const userId = "user1"; // Dummy user ID

  const filterConversations = () => {
    if (activeFilter === "Alle") return DUMMY_CONVERSATIONS;
    
    return DUMMY_CONVERSATIONS.filter((conv) => {
      if (activeFilter === "Oppdrag") {
        // User is the one who posted the job (customer)
        return conv.orderId.customerId === userId;
      } else {
        // User is trying to get the job (provider)
        return conv.orderId.providerId === userId;
      }
    });
  };

  const getOtherParticipant = (conv: Conversation) => {
    return conv.participants.find((p) => p._id !== userId);
  };

  const filteredConversations = filterConversations();

  return (
    <div className={styles.pageContainer}>
      <ProfileTitleWrapper title="Meldinger" buttonText="Tilbake" />
      
      <div className={styles.contentContainer}>
        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          {(["Alle", "Oppdrag", "Forespørsel"] as FilterType[]).map((filter) => (
            <button
              key={filter}
              className={`${styles.filterTab} ${activeFilter === filter ? styles.active : ""}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Conversations List */}
        <div className={styles.conversationsList}>
          {filteredConversations.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ccc' }}>
                chat_bubble_outline
              </span>
              <p>Ingen meldinger</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const otherUser = getOtherParticipant(conv);
              return (
                <div
                  key={conv._id}
                  className={styles.conversationItem}
                  onClick={() => navigate(`/messages/${conv._id}`, { 
                    state: { orderId: conv.orderId._id } 
                  })}
                >
                  <div className={styles.avatarContainer}>
                    {otherUser?.profileImage ? (
                      <img src={otherUser.profileImage} alt={otherUser.name} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {otherUser?.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.conversationContent}>
                    <div className={styles.conversationHeader}>
                      <h3>{otherUser?.name || "Ukjent bruker"}</h3>
                      <span className={styles.timestamp}>
                        {new Date(conv.updatedAt).toLocaleDateString("nb-NO")}
                      </span>
                    </div>
                    <p className={styles.jobTitle}>{conv.orderId.serviceId.title}</p>
                    <p className={styles.lastMessage}>{conv.lastMessage || "Ingen meldinger ennå"}</p>
                  </div>
                  
                  {conv.unreadCount && conv.unreadCount > 0 && (
                    <div className={styles.unreadBadge}>{conv.unreadCount}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
