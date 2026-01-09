import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { initSocket, disconnectSocket } from "../../socket/socket";
import { getChatById, sendMessage, type Chat, type ChatMessage } from "../../api/chatAPI";
import { toast } from "react-toastify";

import styles from "./ConversationView.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";
import { useUserStore } from "../../stores/userStore";

interface Message {
  _id?: string;
  senderId: string | {
    _id: string;
    name: string;
    avatarUrl?: string;
  };
  text: string;
  images?: string[];
  createdAt: string;
  status?: "sent" | "delivered" | "read";
}

interface ReceiveMessagePayload {
  chatId: string;
  message: ChatMessage;
}

export function ConversationView() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useUserStore();
  const userId = user?._id;

  const otherUser = chat
    ? chat.clientId._id === userId
      ? chat.providerId
      : chat.clientId
    : null;

  useEffect(() => {
    if (!conversationId) return;

    const fetchChat = async () => {
      try {
        setLoading(true);
        const chatData = await getChatById(conversationId);
        setChat(chatData);
        setMessages(chatData.messages || []);
      } catch (err) {
        console.error("Fetch chat error:", err);
        toast.error("Kunne ikke laste samtale");
        navigate("/messages");
      } finally {
        setLoading(false);
      }
    };

    fetchChat();

    // ========== SOCKET ==========
    const socket = initSocket();
    if (!socket) return;

    socket.emit("join-chat", conversationId);

    const onReceiveMessage = (data: ReceiveMessagePayload) => {
      if (data.chatId === conversationId) {
        setMessages((prev) => [...prev, data.message]);
        setChat((prevChat) => prevChat ? { ...prevChat, lastMessage: data.message.text } : null);
      }
    };

    socket.on("receive-message", onReceiveMessage);

    return () => {
      socket.off("receive-message", onReceiveMessage);
      socket.emit("leave-chat", conversationId);
      disconnectSocket();
    };
  }, [conversationId, navigate]);

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

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sending) return;

    try {
      setSending(true);
      const msg = await sendMessage(conversationId, newMessage.trim());
      
      setMessages((prev) => [...prev, msg]);
      setChat((prevChat) => prevChat ? { ...prevChat, lastMessage: msg.text } : null);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Kunne ikke sende melding");
    } finally {
      setSending(false);
    }
  };

  const messageGroups = groupMessagesByDate();

  if (loading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.empty}>
          <p>Laster samtale...</p>
        </div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.empty}>
          <p>Samtale ikke funnet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <ProfileTitleWrapper title={otherUser?.name || "Chat"} buttonText="Tilbake" />

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
                {msgs.map((msg, index) => {
                  const senderId = typeof msg.senderId === 'string' ? msg.senderId : msg.senderId._id;
                  const senderName = typeof msg.senderId === 'object' ? msg.senderId.name : 'Unknown';
                  const senderAvatar = typeof msg.senderId === 'object' ? msg.senderId.avatarUrl : undefined;
                  
                  return (
                    <div
                      key={msg._id || index}
                      className={`${styles.messageWrapper} ${
                        senderId === userId
                          ? styles.sent
                          : styles.received
                      }`}
                    >
                      {senderId !== userId && (
                        <div className={styles.avatar}>
                          {senderAvatar ? (
                            <img
                              src={senderAvatar}
                              alt={senderName}
                            />
                          ) : (
                            <div className={styles.avatarPlaceholder}>
                              {senderName?.charAt(0) || '?'}
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
                  );
                })}
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
