import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { initSocket, disconnectSocket } from "../../socket/socket";
import { useUserStore } from "../../stores/userStore";
import { useChatQueries } from "../../features/chat/hook";

// Components
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import ConversationList from "../../components/chat/ConversationList";
import { ContractMessage } from "../../components/chat/ContractMessage/ContractMessage";
import { CreateContractModal } from "../../components/chat/CreateContractModal/CreateContractModal";

type FilterType = "Alle" | "Mine Oppdrag" | "Forespørsler";

export function MessagesPageSplit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States
  const [activeFilter, setActiveFilter] = useState<FilterType>("Alle");
  const [newMessage, setNewMessage] = useState("");
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200);

  const { user } = useUserStore();
  const userId = user?._id;

  // TANSTACK QUERIES (Fetching Logic)
  const { chatsQuery, activeChatQuery, contractQuery, sendMutation } = useChatQueries(conversationId);

  const chats = chatsQuery.data || [];
  const activeChat = activeChatQuery.data;
  const messages = activeChat?.messages || [];
  const contract = contractQuery.data;

  // Window Resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 12800);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Socket & Sync Logic
  useEffect(() => {
    const socket = initSocket();
    if (!socket) return;

    if (conversationId && userId) {
      socket.emit("join-chat", conversationId);
      localStorage.setItem(`lastChatCheck_${userId}_${conversationId}`, new Date().toISOString());
      window.dispatchEvent(new CustomEvent("chat-read"));
    }

    socket.on("receive-message", (data) => {
      queryClient.invalidateQueries({ queryKey: ["chat", data.chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
    });

    if (activeChat?.serviceId?._id) {
      socket.emit("join_service", activeChat.serviceId._id);
      socket.on("contract_created", () => queryClient.invalidateQueries({ queryKey: ["contract"] }));
      socket.on("contract_signed", () => queryClient.invalidateQueries({ queryKey: ["contract"] }));
    }

    return () => {
      socket.off("receive-message");
      socket.off("contract_created");
      socket.off("contract_signed");
      if (conversationId) socket.emit("leave-chat", conversationId);
      disconnectSocket();
    };
  }, [conversationId, userId, queryClient, activeChat?.serviceId?._id]);

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sendMutation.isPending) return;
    sendMutation.mutate(
      { id: conversationId, text: newMessage.trim() },
      { onSuccess: () => setNewMessage("") }
    );
  };

  // FORMATTERS (Original logic preserved)
  const formatTime = (dateString?: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 24) return date.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
    return date.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "I dag";
    if (date.toDateString() === yesterday.toDateString()) return "I går";
    return date.toLocaleDateString("nb-NO", { day: "numeric", month: "long" });
  };

  const groupMessagesByDate = () => {
    const groups: any = {};
    messages.forEach((msg: any) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const filteredChats = chats.filter((chat: any) => {
    if (activeFilter === "Alle") return true;
    if (activeFilter === "Mine Oppdrag") return chat.providerId._id === userId;
    return chat.clientId._id === userId;
  });

  const otherUser = activeChat ? (activeChat.clientId._id === userId ? activeChat.providerId : activeChat.clientId) : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-300 min-h-150 max-h-screen mx-auto flex bg-[#FFFFFF1A] p-6 rounded-xl shadow-md">

        {/* LEFT SIDEBAR */}
        <div className={`${conversationId && isMobile ? "hidden" : "flex"} flex-col w-full xl:w-[380px] xl:min-w-[380px] xl:max-w-[380px] border-r border-[#e8e8e8] bg-[#FFFFFF1A] overflow-hidden transition-all`}>

          {/* FILTER BUTTONS - EXACT ORIGINAL CSS */}
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

          <ConversationList
            loading={chatsQuery.isLoading}
            filteredChats={filteredChats}
            user={user}
            conversationId={conversationId}
            isUnread={(chat: any) => {
              if (chat.clientId._id === userId) {
                return false;
              }
              const lastCheck = localStorage.getItem(`lastChatCheck_${userId}_${chat._id}`);
              return lastCheck ? new Date(chat.updatedAt) > new Date(lastCheck) : true;
            }}
            formatTime={formatTime}
          />
        </div>

        {/* RIGHT SIDE */}
        <div className={`flex-1 flex flex-col min-w-0 max-w-full bg-[#FFFFFFB2] shadow-md rounded-[14px] ml-4 overflow-hidden lg:static lg:h-auto ${!conversationId && isMobile ? "hidden" : "flex"}`} style={{ minHeight: "400px" }}>
          {!conversationId ? (
            <div className="flex flex-col items-center justify-center h-full text-[#999]">
              <span className="material-symbols-outlined text-[64px] text-[#ccc]">chat</span>
              <p className="text-[16px] text-[#666] mt-4">Velg en samtale for å se meldinger</p>
            </div>
          ) : activeChatQuery.isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-[#999]">
              <p className="animate-pulse">Laster samtale...</p>
            </div>
          ) : (
            <>
              <ChatHeader
                isMobile={isMobile}
                otherUser={otherUser}
                activeChat={activeChat}
                contract={contract}
                setShowCreateContract={setShowCreateContract}
              />

              {contract && userId && (
                <div className="px-4 bg-[#FFFFFFB2]">
                  <ContractMessage
                    contract={contract}
                    currentUserId={userId}
                    onContractUpdated={() => queryClient.invalidateQueries({ queryKey: ['contract'] })}
                  />
                </div>
              )}

              <MessageList
                messages={messages}
                messageGroups={groupMessagesByDate()}
                userId={userId}
                formatDate={formatDate}
                formatTime={formatTime}
                messagesEndRef={messagesEndRef}
              />

              <MessageInput
                newMessage={newMessage}
                setNewMessage={setNewMessage}
                handleSend={handleSend}
                sending={sendMutation.isPending}
              />
            </>
          )}
        </div>
      </div>

      {showCreateContract && userId && otherUser && activeChat && (
        <CreateContractModal
          isOpen={showCreateContract}
          onClose={() => setShowCreateContract(false)}
          serviceId={activeChat.serviceId._id}
          serviceTitle={activeChat.serviceId.title || "Service"}
          otherUserId={otherUser._id}
          currentUserId={userId}
          onContractCreated={() => queryClient.invalidateQueries({ queryKey: ['contract'] })}
        />
      )}
    </div>
  );
}