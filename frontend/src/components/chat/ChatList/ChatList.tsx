import { useUserStore } from "../../../stores/userStore";
import styles from "./ChatList.module.css";

/* ================= TYPES ================= */

interface User {
  _id: string;
  name: string;
}

interface Chat {
  _id: string;
  clientId?: User;
  providerId?: User;
  lastMessage?: string;
  updatedAt?: string;
}

interface Props {
  chats: Chat[];
  selectedId?: string;
  onSelect: (chat: Chat) => void;
}

/* ================= COMPONENT ================= */

const ChatList: React.FC<Props> = ({ chats, selectedId, onSelect }) => {
  const { user } = useUserStore();
  const userRole = user?.role;

  // Time format karne ke liye function
  const formatTime = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      {chats.map((chat) => {
        const otherPersonName =
          userRole === "user" ? chat.providerId?.name : chat.clientId?.name;

        return (
          <div
            key={chat._id}
            onClick={() => onSelect(chat)}
            className={`${styles.chatItem} ${
              selectedId === chat._id ? styles.active : ""
            }`}
          >
            <div className={styles.nameContainer}>
              <span className={styles.name}>
                {otherPersonName ?? "Unknown User"}
              </span>
              <span className={styles.time}>
                {formatTime(chat.updatedAt)}
              </span>
            </div>

            <div className={styles.lastMessage}>
              {chat.lastMessage || "No messages yet"}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ChatList;
