import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { initSocket, disconnectSocket } from "../../socket/socket";
import {
  getMyChats,
  deleteChatForMe,
  getChatById,
  sendMessage,
  type Chat,
  type ChatMessage,
} from "../../api/chatAPI";
import { useUserStore } from "../../stores/userStore";
import styles from "./MessagesPageSplit.module.css";
import { toast } from "react-toastify";
import type { Contract } from "../../api/contractAPI";
import { getContractById } from "../../api/contractAPI";
import { ContractMessage } from "../../components/chat/ContractMessage/ContractMessage";
import { CreateContractModal } from "../../components/chat/CreateContractModal/CreateContractModal";
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import ConversationList from "../../components/chat/ConversationList";

interface MessageData {
  chatId: string;
  message: { text: string;[key: string]: any };
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
    return state?.from || sessionStorage.getItem("beforeMessages") || "/";
  });

  // Save current path before navigating to messages
  useEffect(() => {
    if (!location.pathname.startsWith("/messages")) {
      sessionStorage.setItem("beforeMessages", location.pathname);
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
  const [showCreateContract, setShowCreateContract] = useState(false);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1200);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
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
      localStorage.setItem(
        `lastChatCheck_${userId}_${conversationId}`,
        new Date().toISOString()
      );
      // Notify Header to re-check unread status
      window.dispatchEvent(new CustomEvent("chat-read"));
    }

    const fetchChat = async () => {
      try {
        setLoadingChat(true);
        const chatData = await getChatById(conversationId);
        setActiveChat(chatData);
        setMessages(chatData.messages || []);
        // Load contract if exists
        if (chatData.serviceId?._id) {
          loadContract(chatData.serviceId?._id);
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
        const messageSenderId =
          typeof data.message.senderId === "string"
            ? data.message.senderId
            : (data.message.senderId as any)?._id;

        if (messageSenderId === userId) {
          return; // Skip own message (already added optimistically)
        }

        setMessages((prev) => [...prev, data.message]);
        setActiveChat((prevChat) =>
          prevChat ? { ...prevChat, lastMessage: data.message.text } : null
        );
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
          c._id === data.chatId
            ? {
              ...c,
              lastMessage: data.message.text,
              updatedAt: new Date().toISOString(),
            }
            : c
        )
      );
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
    };
  }, []); // Empty dependency array to prevent infinite loop

  // Scroll to bottom when messages change, but only if we're already near the bottom
  useEffect(() => {
    if (messages.length > 0) {
      // Use a slight delay to ensure the DOM has updated
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]); // Only trigger when message count changes, not on every message update

  // Load contract + setup real-time updates
  const loadContract = async (serviceId: string) => {
    try {
      // Initial fetch
      const contractData = await getContractById(serviceId);
      setContract(contractData);

      // Real-time updates
      const socket = initSocket();
      if (!socket) return;

      socket.emit("join_service", serviceId);

      const handleContractCreated = ({
        contract: newContract,
      }: {
        contract: Contract;
      }) => {
        setContract(newContract);
      };

      const handleContractSigned = ({
        contract: updatedContract,
      }: {
        contract: Contract;
      }) => {
        if (contract?._id === updatedContract._id) {
          setContract(updatedContract);
        }
      };

      socket.on("contract_created", handleContractCreated);
      socket.on("contract_signed", handleContractSigned);

      return () => {
        socket.off("contract_created", handleContractCreated);
        socket.off("contract_signed", handleContractSigned);
      };
    } catch (error) {
      console.error("Load contract error:", error);
    }
  };

  const handleContractUpdated = () => {
    if (activeChat?.serviceId?._id) {
      loadContract(activeChat.serviceId?._id);
    }
    if (conversationId) {
      // Refresh the chat to get updated contract info
      getChatById(conversationId).then((chatData) => {
        setActiveChat(chatData);
        if (chatData.serviceId?._id) {
          loadContract(chatData.serviceId?._id);
        }
      });
    }
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return "";

    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0) return "";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    // Same day → show time
    if (diffHours < 24) {
      return date.toLocaleTimeString("nb-NO", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Older → show date + year
    return date.toLocaleDateString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",   // 👈 year add kiya
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

    const lastCheckedTime = localStorage.getItem(
      `lastChatCheck_${userId}_${chat._id}`
    );

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
      setActiveChat((prevChat) =>
        prevChat ? { ...prevChat, lastMessage: msg.text } : null
      );
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

  const serviceDescription = activeChat?.serviceId?.description || "";
  const serviceAddress = (activeChat as any)?.serviceId?.location?.address || "";

  const messageGroups = groupMessagesByDate();

  return (
    <div
      className=""
      style={{ minHeight: "100vh" }}
    >
      {/* Back button to leave messages page */}
      {/* <div className={styles.backButtonContainer}>
        <button
          className={styles.pageBackButton}
          onClick={() => navigate(returnPath)}
          aria-label="Gå tilbake"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Tilbake
        </button>
      </div> */}

      {/* <div className={`styles.splitContainer`} style={{ minHeight: "600px" }}> */}
      <div className={`max-w-300 max-h-195.25 mx-auto flex bg-[#FFFFFF1A] p-6 rounded-xl shadow-md`} style={{ minHeight: "600px" }}>
        {/* LEFT SIDEBAR - Chat List */}
        <div
          className={`${conversationId && isMobile ? "hidden" : "flex"
            } flex-col w-full xl:w-[380px] xl:min-w-[380px] xl:max-w-[380px] border-r border-[#e8e8e8] bg-[#FFFFFF1A] overflow-hidden transition-all`}
          style={{ minHeight: "400px" }}
        >
          {/* Filter Tabs */}
          <div className="flex gap-2 p-4 bg-[#FFFFFF1A] border-bottom flex-wrap">
            {(["Alle", "Mine Oppdrag", "Forespørsler"] as FilterType[]).map((filter) => (
              <button
                key={filter}
                className={`flex-1 py-2 px-3 rounded-full border text-[11px] sm:text-[14px] whitespace-nowrap overflow-hidden text-ellipsis transition-all duration-200 ${activeFilter === filter
                  ? "bg-[#ea7e15] text-white border-[#ea7e15]"
                  : "bg-[#FFFFFF1A] shadow-md hover:bg-[#2F7E4740] hover:text-white text-[#2B2B2B]"
                  }`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Conversations List */}
          <ConversationList
            loading={loading}
            filteredChats={filteredChats}
            user={user}
            conversationId={conversationId}
            isUnread={isUnread}
            formatTime={formatTime}
          />
        </div>

        {/* RIGHT SIDE - Conversation View */}
        <div
          className={`flex-1 flex flex-col min-w-0 max-w-full bg-[#FFFFFFB2] shadow-md rounded-[14px] ml-4 overflow-hidden xl:static xl:h-auto ${!conversationId && isMobile ? "hidden" : "flex"
            }`}
          style={{ minHeight: "400px" }}
        >
          {!conversationId ? (
            <div className="flex flex-col items-center justify-center h-full text-[#999]">
              <span
                className="material-symbols-outlined text-[64px] text-[#ccc]"
              >
                chat
              </span>
              <p className="text-[16px] text-[#666] mt-4">
                Velg en samtale for å se meldinger
              </p>
            </div>
          ) : loadingChat ? (
            <div className="flex flex-col items-center justify-center h-full text-[#999]">
              <p className="animate-pulse">Laster samtale...</p>
            </div>
          ) : !activeChat ? (
            <div className="flex flex-col items-center justify-center h-full text-[#999]">
              <p>Samtale ikke funnet</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <ChatHeader
                isMobile={isMobile}
                otherUser={otherUser}
                activeChat={activeChat}
                contract={contract}
                setShowCreateContract={setShowCreateContract}
              />

              {/* Contract Display */}
              {contract && userId && (
                <div className="px-4 bg-[#FFFFFFB2]">
                  <ContractMessage
                    contract={contract}
                    currentUserId={userId}
                    onContractUpdated={handleContractUpdated}
                  />
                </div>
              )}

              {/* Messages Area */}
              <MessageList
                messages={messages}
                messageGroups={messageGroups}
                userId={userId}
                formatDate={formatDate}
                formatTime={formatTime}
                messagesEndRef={messagesEndRef}
              />

              {/* Message Input */}
              <MessageInput
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                handleSend={handleSend}
                sending={sending}
              />
            </>
          )}
        </div>
      </div>

      <div>

      </div>

      {/* Create Contract Modal */}
      {userId && otherUser && activeChat && (
        <CreateContractModal
          isOpen={showCreateContract}
          onClose={() => setShowCreateContract(false)}
          serviceId={activeChat.serviceId._id}
          serviceTitle={activeChat.serviceId.title || "Service"}
          serviceDescription={serviceDescription}
          serviceAddress={serviceAddress}
          otherUserId={otherUser._id}
          currentUserId={userId}
          onContractCreated={handleContractUpdated}
        />
      )}
    </div>
  );
}
