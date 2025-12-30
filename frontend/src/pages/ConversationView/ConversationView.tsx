import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import styles from "./ConversationView.module.css";
import { ProfileTitleWrapper } from "../../components/layout/body/profile/ProfileTitleWrapper";

interface Message {
  _id: string;
  senderId: {
    _id: string;
    name: string;
    profileImage?: string;
  };
  message: string;
  images?: string[];
  createdAt: string;
  status: "sent" | "delivered" | "read";
}

// Dummy messages data
const DUMMY_MESSAGES: Message[] = [
  {
    _id: "msg1",
    senderId: {
      _id: "user2",
      name: "Kari Nordmann"
    },
    message: "Hei! Jeg så annonsen din om snømåking. Er det fortsatt ledig?",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: "read"
  },
  {
    _id: "msg2",
    senderId: {
      _id: "user1",
      name: "Ole Hansen"
    },
    message: "Ja, det stemmer! Når kan du starte?",
    createdAt: new Date(Date.now() - 86400000 * 2 + 3600000).toISOString(),
    status: "read"
  },
  {
    _id: "msg3",
    senderId: {
      _id: "user2",
      name: "Kari Nordmann"
    },
    message: "Jeg kan starte allerede i morgen tidlig, rundt kl 07:00. Passer det?",
    createdAt: new Date(Date.now() - 86400000 + 7200000).toISOString(),
    status: "read"
  },
  {
    _id: "msg4",
    senderId: {
      _id: "user1",
      name: "Ole Hansen"
    },
    message: "Perfekt! Snakkes i morgen 👍",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    status: "delivered"
  }
];

export function ConversationView() {
  const { conversationId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<Message[]>(DUMMY_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const userId = "user1"; // Dummy user ID
  const jobTitle = "Snømåking - Oslo sentrum"; // Dummy job title

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    
    // Simulate sending message (dummy)
    const sentMessage: Message = {
      _id: `msg${messages.length + 1}`,
      senderId: {
        _id: userId,
        name: "Ole Hansen"
      },
      message: newMessage,
      createdAt: new Date().toISOString(),
      status: "sent"
    };

    setMessages([...messages, sentMessage]);
    setNewMessage("");
    
    // Simulate API delay
    setTimeout(() => {
      setSending(false);
    }, 500);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
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
      return date.toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
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

  const messageGroups = groupMessagesByDate();

  return (
    <div className={styles.pageContainer}>
      <ProfileTitleWrapper 
        title={jobTitle} 
        buttonText="Tilbake" 
      />
      
      <div className={styles.chatContainer}>
        <div className={styles.messagesArea}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <span className="material-symbols-outlined" style={{ fontSize: '48px', color: '#ccc' }}>
                chat
              </span>
              <p>Ingen meldinger ennå</p>
              <p className={styles.emptySubtext}>Send en melding for å starte samtalen</p>
            </div>
          ) : (
            Object.entries(messageGroups).map(([date, msgs]) => (
              <div key={date}>
                <div className={styles.dateLabel}>
                  {formatDate(msgs[0].createdAt)}
                </div>
                {msgs.map((msg) => (
                  <div
                    key={msg._id}
                    className={`${styles.messageWrapper} ${
                      msg.senderId._id === userId ? styles.sent : styles.received
                    }`}
                  >
                    {msg.senderId._id !== userId && (
                      <div className={styles.avatar}>
                        {msg.senderId.profileImage ? (
                          <img src={msg.senderId.profileImage} alt={msg.senderId.name} />
                        ) : (
                          <div className={styles.avatarPlaceholder}>
                            {msg.senderId.name.charAt(0).toUpperCase()}
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
                      <p className={styles.messageText}>{msg.message}</p>
                      <span className={styles.messageTime}>{formatTime(msg.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form className={styles.inputArea} onSubmit={handleSendMessage}>
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
              className={styles.messageInput}
              disabled={sending}
            />
            
            <button 
              type="submit" 
              className={styles.sendButton}
              disabled={!newMessage.trim() || sending}
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
