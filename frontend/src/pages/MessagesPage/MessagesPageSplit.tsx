import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { initSocket, disconnectSocket } from "../../socket/socket";
import { getMyChats, deleteChatForMe, getChatById, sendMessage, type Chat, type ChatMessage } from "../../api/chatAPI";
import { useUserStore } from "../../stores/userStore";
import styles from "./MessagesPageSplit.module.css";
import { toast } from "react-toastify";
import type { Contract } from "../../api/contractAPI";
import { getContractById } from "../../api/contractAPI";
import { ContractMessage } from "../../components/chat/ContractMessage/ContractMessage";
import { CreateContractModal } from "../../components/chat/CreateContractModal/CreateContractModal";

interface MessageData {
  chatId: string;
  message: { text: string; [key: string]: any };
}

interface ReceiveMessagePayload {
  chatId: string;
  message: ChatMessage;
}

type FilterType = "Alle" | "Mine Oppdrag" | "Forespørsler";

export function MessagesPageSplit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("Alle");
  const { user } = useUserStore();
  const userId = user?._id;
  
  // Track window width for responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200);
  
  // Track where user came from when first entering messages page
  const [returnPath] = useState(() => {
    // If coming from another page (not within messages), save that path
    const state = location.state as { from?: string } | null;
    return state?.from || sessionStorage.getItem('beforeMessages') || '/';
  });
  
  // Save current path before navigating to messages
  useEffect(() => {
    if (!location.pathname.startsWith('/messages')) {
      sessionStorage.setItem('beforeMessages', location.pathname);
    }
  }, [location.pathname]);

  // Active chat state
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  // Contract state
  const [contract, setContract] = useState<Contract | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [showCreateContract, setShowCreateContract] = useState(false);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1200);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch all chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        setLoading(true);
        const data = await getMyChats();
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

  // Load active chat when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setActiveChat(null);
      setMessages([]);
      setContract(null);
      return;
    }

    // Mark this chat as read when opening it
    if (userId) {
      localStorage.setItem(`lastChatCheck_${userId}_${conversationId}`, new Date().toISOString());
      // Notify Header to re-check unread status
      window.dispatchEvent(new CustomEvent('chat-read'));
    }

    const fetchChat = async () => {
      try {
        setLoadingChat(true);
        const chatData = await getChatById(conversationId);
        setActiveChat(chatData);
        setMessages(chatData.messages || []);
        
        // Load contract if exists
        if (chatData.contractId) {
          loadContract(chatData.contractId);
        } else {
          setContract(null);
        }
      } catch (err) {
        console.error("Fetch chat error:", err);
        toast.error("Kunne ikke laste samtale");
      } finally {
        setLoadingChat(false);
      }
    };

    fetchChat();

    // Socket setup for active chat
    const socket = initSocket();
    if (!socket) return;

    socket.emit("join-chat", conversationId);

    const onReceiveMessage = (data: ReceiveMessagePayload) => {
      if (data.chatId === conversationId) {
        const messageSenderId = typeof data.message.senderId === 'string' 
          ? data.message.senderId 
          : (data.message.senderId as any)?._id;
          
        if (messageSenderId === userId) {
          return; // Skip own message (already added optimistically)
        }
        
        setMessages((prev) => [...prev, data.message]);
        setActiveChat((prevChat) => prevChat ? { ...prevChat, lastMessage: data.message.text } : null);
      }
    };

    socket.on("receive-message", onReceiveMessage);

    return () => {
      socket.off("receive-message", onReceiveMessage);
      socket.emit("leave-chat", conversationId);
      disconnectSocket();
    };
  }, [conversationId, userId]);

  // Update chat list on new messages
  useEffect(() => {
    const socket = initSocket();

    const handleReceiveMessage = (data: MessageData) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === data.chatId ? { ...c, lastMessage: data.message.text, updatedAt: new Date().toISOString() } : c
        )
      );
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, []); // Empty dependency array to prevent infinite loop

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadContract = async (contractId: string) => {
    try {
      setLoadingContract(true);
      const contractData = await getContractById(contractId);
      setContract(contractData);
    } catch (error) {
      console.error("Load contract error:", error);
    } finally {
      setLoadingContract(false);
    }
  };

  const handleContractUpdated = () => {
    if (activeChat?.contractId) {
      loadContract(activeChat.contractId);
    }
    if (conversationId) {
      // Refresh the chat to get updated contract info
      getChatById(conversationId).then(chatData => {
        setActiveChat(chatData);
        if (chatData.contractId) {
          loadContract(chatData.contractId);
        }
      });
    }
  };

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
    const groups: { [key: string]: ChatMessage[] } = {};
    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const filterChats = () => {
    if (activeFilter === "Alle") {
      return chats;
    } else if (activeFilter === "Mine Oppdrag") {
      return chats.filter((chat) => chat.providerId._id === user?._id);
    } else {
      return chats.filter((chat) => chat.clientId._id === user?._id);
    }
  };

  const isUnread = (chat: Chat) => {
    if (!userId || !chat.updatedAt) return false;
    
    const lastCheckedTime = localStorage.getItem(`lastChatCheck_${userId}_${chat._id}`);
    
    // If never checked before, only mark as unread if updated in last 7 days
    if (!lastCheckedTime) {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(chat.updatedAt) > weekAgo;
    }
    
    const lastChecked = new Date(lastCheckedTime);
    const chatUpdated = new Date(chat.updatedAt);
    return chatUpdated > lastChecked;
  };

  const filteredChats = filterChats();

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    
    if (!confirm("Er du sikker på at du vil slette denne samtalen?")) {
      return;
    }

    try {
      await deleteChatForMe(chatId);
      setChats((prev) => prev.filter((chat) => chat._id !== chatId));
      if (activeChat?._id === chatId) {
        navigate("/messages");
      }
      toast.success("Samtale slettet");
    } catch (error) {
      console.error("Error deleting chat:", error);
      toast.error("Kunne ikke slette samtale");
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sending) return;

    try {
      setSending(true);
      const msg = await sendMessage(conversationId, newMessage.trim());
      
      setMessages((prev) => [...prev, msg]);
      setActiveChat((prevChat) => prevChat ? { ...prevChat, lastMessage: msg.text } : null);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Kunne ikke sende melding");
    } finally {
      setSending(false);
    }
  };

  const otherUser = activeChat
    ? activeChat.clientId._id === userId
      ? activeChat.providerId
      : activeChat.clientId
    : null;

  const messageGroups = groupMessagesByDate();

  return (
    <div className={styles.pageContainer} style={{ minHeight: "100vh", background: "#f0f0f0" }}>
      {/* Back button to leave messages page */}
      <div className={styles.backButtonContainer}>
        <button 
          className={styles.pageBackButton}
          onClick={() => navigate(returnPath)}
          aria-label="Gå tilbake"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Tilbake
        </button>
      </div>
      
      <div className={styles.splitContainer} style={{ minHeight: "600px" }}>
        {/* LEFT SIDEBAR - Chat List */}
        <div 
          className={styles.sidebar}
          style={{ 
            display: conversationId && isMobile ? "none" : "flex",
            minHeight: "400px"
          }}
        >
          {/* Filter Tabs */}
          <div className={styles.filterTabs}>
            {(["Alle", "Mine Oppdrag", "Forespørsler"] as FilterType[]).map(
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
                <span className="material-symbols-outlined" style={{ fontSize: "36px", color: "#ccc" }}>
                  chat_bubble_outline
                </span>
                <p style={{ fontSize: "14px", color: "#666", marginTop: "8px" }}>Ingen meldinger</p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const otherPerson =
                  chat.clientId._id === user?._id
                    ? chat.providerId
                    : chat.clientId;

                const hasUnread = isUnread(chat);
                
                return (
                  <div
                    key={chat._id}
                    className={`${styles.chatCard} ${conversationId === chat._id ? styles.activeChatCard : ""}`}
                    onClick={() => navigate(`/messages/${chat._id}`)}
                  >
                    <div className={styles.chatHeader}>
                      <div className={styles.userBadge}>
                        <div className={styles.userAvatar}>
                          {otherPerson.avatarUrl ? (
                            <img src={otherPerson.avatarUrl} alt={otherPerson.name} />
                          ) : (
                            <span>{otherPerson.name?.charAt(0) || '?'}</span>
                          )}
                        </div>
                        <span className={styles.userName}>
                          {otherPerson.name || "Ukjent bruker"}
                        </span>
                        {hasUnread && <span className={styles.unreadBadge}></span>}
                      </div>
                      <span className={styles.timeAgo}>
                        {formatTime(chat.updatedAt)}
                      </span>
                    </div>

                    <h3 className={styles.jobHeading}>
                      {chat.serviceId?.title || "Jobb"}
                    </h3>

                    <p className={styles.messagePreview}>
                      {chat.lastMessage || "Start samtalen..."}
                    </p>

                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => handleDeleteChat(e, chat._id)}
                      aria-label="Slett samtale"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT SIDE - Conversation View */}
        <div 
          className={styles.conversationPanel}
          style={{ 
            display: !conversationId && isMobile ? "none" : "flex",
            minHeight: "400px"
          }}
        >
          {!conversationId ? (
            <div className={styles.emptyConversation}>
              <span className="material-symbols-outlined" style={{ fontSize: "64px", color: "#ccc" }}>
                chat
              </span>
              <p style={{ fontSize: "16px", color: "#666", marginTop: "16px" }}>
                Velg en samtale for å se meldinger
              </p>
            </div>
          ) : loadingChat ? (
            <div className={styles.emptyConversation}>
              <p>Laster samtale...</p>
            </div>
          ) : !activeChat ? (
            <div className={styles.emptyConversation}>
              <p>Samtale ikke funnet</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className={styles.conversationHeader}>
                {/* Back button for mobile */}
                {isMobile && (
                  <button 
                    className={styles.backButton}
                    onClick={() => navigate('/messages')}
                    aria-label="Tilbake til samtaler"
                  >
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                )}
                
                <div className={styles.headerUser}>
                  <div className={styles.headerAvatar}>
                    {otherUser?.avatarUrl ? (
                      <img src={otherUser.avatarUrl} alt={otherUser.name} />
                    ) : (
                      <span>{otherUser?.name?.charAt(0) || '?'}</span>
                    )}
                  </div>
                  <div className={styles.headerInfo}>
                    <h3>{otherUser?.name || "Chat"}</h3>
                    {activeChat.serviceId && (
                      <p className={styles.jobContext}>
                        Angående: {activeChat.serviceId.title || "Jobb"}
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Send Contract Button */}
                {!activeChat.contractId && activeChat.serviceId && (
                  <button 
                    className={styles.contractButton}
                    onClick={() => setShowCreateContract(true)}
                  >
                    <span className="material-symbols-outlined">description</span>
                    Send Contract
                  </button>
                )}
              </div>

              {/* Contract Display */}
              {contract && userId && (
                <div className={styles.contractSection}>
                  <ContractMessage 
                    contract={contract}
                    currentUserId={userId}
                    onContractUpdated={handleContractUpdated}
                  />
                </div>
              )}

              {/* Messages Area */}
              <div className={styles.messagesArea}>
                {messages.length === 0 ? (
                  <div className={styles.emptyMessages}>
                    <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#ccc" }}>
                      chat
                    </span>
                    <p>Ingen meldinger ennå</p>
                    <p style={{ fontSize: "14px", color: "#999", marginTop: "8px" }}>
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
                        const senderId = typeof msg.senderId === 'string' ? msg.senderId : (msg.senderId as any)?._id;
                        const senderName = typeof msg.senderId === 'object' ? (msg.senderId as any)?.name : 'Unknown';
                        const senderAvatar = typeof msg.senderId === 'object' ? (msg.senderId as any)?.avatarUrl : undefined;
                        const isSentByMe = senderId === userId;
                        
                        return (
                          <div
                            key={msg._id || index}
                            className={`${styles.messageWrapper} ${
                              isSentByMe ? styles.sent : styles.received
                            }`}
                          >
                            {!isSentByMe && (
                              <div className={styles.avatar}>
                                {senderAvatar ? (
                                  <img src={senderAvatar} alt={senderName} />
                                ) : (
                                  <div className={styles.avatarPlaceholder}>
                                    {senderName?.charAt(0) || '?'}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className={styles.messageBubble}>
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
            </>
          )}
        </div>
      </div>

      {/* Create Contract Modal */}
      {activeChat && activeChat.serviceId && userId && otherUser && (
        <CreateContractModal 
          isOpen={showCreateContract}
          onClose={() => setShowCreateContract(false)}
          serviceId={activeChat.serviceId._id}
          serviceTitle={activeChat.serviceId.title || "Service"}
          otherUserId={otherUser._id}
          currentUserId={userId}
          onContractCreated={handleContractUpdated}
        />
      )}
    </div>
  );
}
