import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import { getChatById, sendMessage, type Chat, type ChatMessage } from "../../api/chatAPI";
import { initSocket } from "../../socket/socket";
import { toast } from "react-hot-toast";
import styles from "./ChatView.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";

export function ChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherUser = chat
    ? chat.clientId._id === user?._id
      ? chat.providerId
      : chat.clientId
    : null;

  useEffect(() => {
    if (!chatId) return;

    const fetchChat = async () => {
      try {
        setLoading(true);
        const chatData = await getChatById(chatId);
        setChat(chatData);
      } catch (error) {
        console.error("Error fetching chat:", error);
        toast.error("Kunne ikke laste samtale");
        navigate("/messages");
      } finally {
        setLoading(false);
      }
    };

    fetchChat();
  }, [chatId, navigate]);

  useEffect(() => {
    if (!chatId) return;

    const socket = initSocket();

    // Join the chat room
    socket.emit("join-chat", chatId);

    // Listen for new messages
    const handleReceiveMessage = (data: { chatId: string; message: ChatMessage }) => {
      if (data.chatId === chatId) {
        setChat((prevChat) => {
          if (!prevChat) return prevChat;
          
          const exists = prevChat.messages.some(m => 
            (m._id && m._id === data.message._id) || 
            (m.createdAt === data.message.createdAt && m.text === data.message.text && m.senderId === data.message.senderId)
          );
          
          if (exists) return prevChat;

          return {
            ...prevChat,
            messages: [...prevChat.messages, data.message],
            lastMessage: data.message.text,
          };
        });
      }
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.emit("leave-chat", chatId);
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [chatId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !chatId || sending) return;

    try {
      setSending(true);
      const newMessage = await sendMessage(chatId, messageText.trim());
      
      setChat((prevChat) => {
        if (!prevChat) return prevChat;
        
        // Check if socket already added it to prevent double-display
        const exists = prevChat.messages.some(m => m._id === newMessage._id);
        if (exists) return prevChat;

        return {
          ...prevChat,
          messages: [...prevChat.messages, newMessage],
          lastMessage: newMessage.text,
        };
      });

      setMessageText("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Kunne ikke sende melding");
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "I går " + date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    } else if (days < 7) {
      return date.toLocaleDateString("nb-NO", { weekday: "short" }) + " " + 
             date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit" }) + " " +
             date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Laster samtale...</div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Samtale ikke funnet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper
        title={otherUser?.name || "Chat"}
        buttonText="Tilbake"
      />

      <div className={styles.chatContainer}>
        <div className={styles.messagesContainer}>
          {chat.messages.length === 0 ? (
            <div className={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#ccc" }}>
                chat_bubble_outline
              </span>
              <p>Ingen meldinger ennå. Send den første!</p>
            </div>
          ) : (
            chat.messages.map((msg, index) => {
              const senderId = typeof msg.senderId === 'string' ? msg.senderId : (msg.senderId as any)?._id;
              const isOwnMessage = senderId === user?._id;
              return (
                <div
                  key={msg._id || index}
                  className={`${styles.messageWrapper} ${
                    isOwnMessage ? styles.own : styles.other
                  }`}
                >
                  <div className={styles.messageBubble}>
                    <p className={styles.messageText}>{msg.text}</p>
                    <span className={styles.messageTime}>
                      {formatMessageTime(msg.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className={styles.inputContainer}>
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Skriv en melding..."
            className={styles.messageInput}
            disabled={sending}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!messageText.trim() || sending}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
