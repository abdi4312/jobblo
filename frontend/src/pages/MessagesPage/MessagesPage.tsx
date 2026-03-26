import { useState, useEffect } from "react";
import { getMyChats, deleteChat, deleteChatForMe } from "../../api/chatAPI";
import { initSocket } from "../../socket/socket";
import type { Chat } from "../../api/chatAPI";
import styles from "./MessagesPage.module.css";
import { Link } from "react-router-dom";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { useUserStore } from "../../stores/userStore";

export function MessagesPage() {
  const { user } = useUserStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
        const data = await getMyChats();
        setChats(data);
      } catch (error) {
        console.error("Error fetching chats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();

    const socket = initSocket();
    const handleReceiveMessage = () => {
      fetchChats();
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, []);

  const handleDeleteChat = async (chatId: string) => {
    if (window.confirm("Er du sikker på at du vil slette denne samtalen for alle?")) {
      try {
        await deleteChat(chatId);
        setChats(chats.filter((c) => c._id !== chatId));
      } catch (error) {
        console.error("Error deleting chat:", error);
      }
    }
  };

  const handleHideChat = async (chatId: string) => {
    try {
      await deleteChatForMe(chatId);
      setChats(chats.filter((c) => c._id !== chatId));
    } catch (error) {
      console.error("Error hiding chat:", error);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Laster meldinger...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title="Mine Meldinger" buttonText="Tilbake" />
      
      <div className={styles.chatList}>
        {chats.length === 0 ? (
          <div className={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#ccc" }}>
              mail_outline
            </span>
            <p>Du har ingen meldinger ennå.</p>
          </div>
        ) : (
          chats.map((chat) => {
            const otherUser = chat.clientId._id === user?._id ? chat.providerId : chat.clientId;
            return (
              <div key={chat._id} className={styles.chatItem}>
                <Link to={`/messages/${chat._id}`} className={styles.chatLink}>
                  <div className={styles.chatInfo}>
                    <h3 className={styles.userName}>{otherUser.name}</h3>
                    <p className={styles.lastMsg}>{chat.lastMessage || "Ingen meldinger ennå"}</p>
                    {chat.serviceId && (
                      <span className={styles.serviceTitle}>{chat.serviceId.title}</span>
                    )}
                  </div>
                </Link>
                <div className={styles.actions}>
                  <button onClick={() => handleHideChat(chat._id)} title="Skjul">
                     <span className="material-symbols-outlined">visibility_off</span>
                  </button>
                  <button onClick={() => handleDeleteChat(chat._id)} title="Slett" className={styles.deleteBtn}>
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
