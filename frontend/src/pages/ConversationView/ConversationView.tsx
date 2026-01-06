import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { initSocket } from "../../socket/socket";

import styles from "./ConversationView.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { useUserStore } from "../../stores/userStore";
import mainLink from "../../api/mainURLs";

interface Message {
  _id: string;
  senderId: {
    _id: string;
    name: string;
    avatarUrl?: string;
    text: string;
  };
  message: string;
  images?: string[];
  createdAt: string;
  status: "sent" | "delivered" | "read";
}
interface SendMessagePayload {
  chatId: string;
  text: string;
}
interface ReceiveMessagePayload {
  chatId: string;
  message: Message;
}

export function ConversationView() {
  const { conversationId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const jobTitle = "Snømåking - Oslo sentrum"; // Dummy job title
  const { user } = useUserStore();
  const userId = user?._id;

  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      try {
        const res = await mainLink.get(`/api/chats/${conversationId}`);
        setMessages(res.data.messages ?? []);
      } catch (err) {
        console.error("Fetch messages error:", err);
      }
    };

    fetchMessages();

    // ========== SOCKET ==========
    const socket = initSocket();
    if (!socket) return;

    socket.emit("join-chat", conversationId);

    const onReceiveMessage = (data: ReceiveMessagePayload) => {
      if (data.chatId === conversationId) {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    socket.on("receive-message", onReceiveMessage);

    return () => {
      socket.off("receive-message", onReceiveMessage);
      socket.emit("leave-chat", conversationId);
    };
  }, [conversationId]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("nb-NO", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "I dag";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "I går";
    } else {
      return date.toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "long",
      });
    }
  };

  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const handleSend = () => {
    if (!newMessage.trim()) return;

    const socket = initSocket();
    if (!socket) return;

    socket.emit("send-message", {
      chatId: conversationId,
      text: newMessage.trim(),
    });

    setNewMessage("");
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className={styles.pageContainer}>
      <ProfileTitleWrapper title={jobTitle} buttonText="Tilbake" />

      <div className={styles.chatContainer}>
        <div className={styles.messagesArea}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "48px", color: "#ccc" }}
              >
                chat
              </span>
              <p>Ingen meldinger ennå</p>
              <p className={styles.emptySubtext}>
                Send en melding for å starte samtalen
              </p>
            </div>
          ) : (
            Object.entries(messageGroups).map(([date, msgs]) => (
              <div key={date}>
                <div className={styles.dateLabel}>
                  {formatDate(msgs[0].createdAt)}
                </div>
                {msgs.map((msg, index) => (
                  <div
                    key={msg._id || index}
                    className={`${styles.messageWrapper} ${
                      msg.senderId._id === userId
                        ? styles.sent
                        : styles.received
                    }`}
                  >
                    {msg.senderId._id !== userId && (
                      <div className={styles.avatar}>
                        {msg.senderId.avatarUrl ? (
                          <img
                            src={msg.senderId.avatarUrl}
                            alt={msg.senderId.name}
                          />
                        ) : (
                          <div className={styles.avatarPlaceholder}>
                            {msg.senderId.name}
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.messageBubble}>
                      {msg.images && msg.images.length > 0 && (
                        <div className={styles.messageImages}>
                          {msg.images.map((img, idx) => (
                            <img key={idx} src={img} alt="attachment" />
                          ))}
                        </div>
                      )}
                      <p className={styles.messageText}>{msg.text}</p>
                      <span className={styles.messageTime}>
                        {formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className={styles.inputArea}>
          <div className={styles.inputContainer}>
            <button
              type="button"
              className={styles.attachButton}
              aria-label="Legg ved fil"
            >
              <span className="material-symbols-outlined">attach_file</span>
            </button>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Skriv en melding..."
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className={styles.messageInput}
              disabled={sending}
            />

            <button
              type="submit"
              className={styles.sendButton}
              disabled={!newMessage.trim() || sending}
              onClick={handleSend}
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
