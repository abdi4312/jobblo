import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { initSocket, disconnectSocket } from "../../socket/socket";
import { getMyChats, deleteChatForMe, type Chat } from "../../api/chatAPI";
import { useUserStore } from "../../stores/userStore";
import styles from "./MessagesPage.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { toast } from "react-toastify";

interface MessageData {
  chatId: string;
  message: { text: string; [key: string]: any };
}

type FilterType = "Alle" | "Mine Oppdrag" | "Mine Forespørsler";

export function MessagesPage() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("Alle");
  const { user } = useUserStore();
  const userRole = user?.role;

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
        const data = await getMyChats();
        console.log("Fetched chats:", data);
        setChats(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Fetch chats error:", error);
        toast.error("Kunne ikke laste samtaler");
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, []);

  useEffect(() => {
    const socket = initSocket();

    const handleReceiveMessage = (data: MessageData) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === data.chatId ? { ...c, lastMessage: data.message.text } : c
        )
      );
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      disconnectSocket();
    };
  }, []);

  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours < 24) {
      return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit" });
    }
  };

  const filterChats = () => {
    if (activeFilter === "Alle") {
      return chats;
    } else if (activeFilter === "Mine Oppdrag") {
      // Chats for jobs I posted (I'm the provider)
      return chats.filter((chat) => chat.providerId._id === user?._id);
    } else {
      // Mine Forespørsler - Chats for jobs I'm asking for (I'm the client)
      return chats.filter((chat) => chat.clientId._id === user?._id);
    }
  };

  const filteredChats = filterChats();

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Prevent navigating to chat when clicking delete
    
    if (!confirm("Er du sikker på at du vil slette denne samtalen?")) {
      return;
    }

    try {
      await deleteChatForMe(chatId);
      setChats((prev) => prev.filter((chat) => chat._id !== chatId));
      toast.success("Samtale slettet");
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Kunne ikke slette samtale");
    }
  };

  return (
    <div className={styles.pageContainer}>
      <ProfileTitleWrapper title="Meldinger" buttonText="Tilbake" />

      <div className={styles.contentContainer}>
        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          {(["Alle", "Mine Oppdrag", "Mine Forespørsler"] as FilterType[]).map(
            (filter) => (
              <button
                key={filter}
                className={`${styles.filterTab} ${
                  activeFilter === filter ? styles.active : ""
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            )
          )}
        </div>

        {/* Conversations List */}
        <div className={styles.conversationsList}>
          {loading ? (
            <div className={styles.empty}>
              <p>Laster...</p>
            </div>
          ) : filteredChats.length === 0 ? (
            <div className={styles.empty}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "48px", color: "#ccc" }}
              >
                chat_bubble_outline
              </span>
              <p>Ingen meldinger</p>
            </div>
          ) : (
            filteredChats.map((chat) => {
              const otherPerson =
                chat.clientId._id === user?._id
                  ? chat.providerId
                  : chat.clientId;

              return (
                <div
                  key={chat._id}
                  className={styles.conversationItem}
                  onClick={() => navigate(`/messages/${chat._id}`)}
                >
                  <div className={styles.avatarContainer}>
                    {otherPerson.avatarUrl ? (
                      <img src={otherPerson.avatarUrl} alt={otherPerson.name} />
                    ) : (
                      <div className={styles.avatarPlaceholder}>
                        {otherPerson.name?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>

                  <div className={styles.conversationContent}>
                    <div className={styles.conversationHeader}>
                      <h3>{otherPerson.name || "Ukjent bruker"}</h3>
                      <span className={styles.timestamp}>
                        {formatTime(chat.updatedAt)}
                      </span>
                    </div>
                    <p className={styles.lastMessage}>
                      {chat.lastMessage || "Ingen meldinger ennå"}
                    </p>
                  </div>

                  <button
                    className={styles.deleteButton}
                    onClick={(e) => handleDeleteChat(e, chat._id)}
                    aria-label="Slett samtale"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
