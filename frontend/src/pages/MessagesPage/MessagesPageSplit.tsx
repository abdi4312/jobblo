import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { initSocket } from "../../socket/socket";
import { useUserStore } from "../../stores/userStore";
import { useChatQueries } from "../../features/chat/hook";

// Components
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import ConversationList from "../../components/chat/ConversationList";
import { ContractMessage } from "../../components/chat/ContractMessage/ContractMessage";
import { CreateContractModal } from "../../components/chat/CreateContractModal/CreateContractModal";

type FilterType = "All" | "Purchases" | "Sales";

export function MessagesPageSplit() {
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [newMessage, setNewMessage] = useState("");
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const { user } = useUserStore();
  const userId = user?._id;

  // TANSTACK QUERIES (Fetching Logic)
  const { chatsQuery, activeChatQuery, contractQuery, sendMutation } =
    useChatQueries(conversationId);

  const chats = chatsQuery.data || [];
  const activeChat = activeChatQuery.data;
  const messages = activeChat?.messages || [];
  const contract = contractQuery.data;

  const otherUser = activeChat
    ? activeChat.clientId._id === userId
      ? activeChat.providerId
      : activeChat.clientId
    : null;

  const isOtherUserOnline =
    otherUser?._id && onlineUsers.includes(otherUser._id);

  // Window Resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1200);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Socket & Sync Logic
  useEffect(() => {
    const socket = initSocket();
    if (!socket) return;

    if (userId) {
      socket.emit("setup", userId);
    }

    if (conversationId && userId) {
      socket.emit("join-chat", conversationId);
      socket.emit("mark-as-read", { chatId: conversationId, userId });
      localStorage.setItem(
        `lastChatCheck_${userId}_${conversationId}`,
        new Date().toISOString(),
      );
      window.dispatchEvent(new CustomEvent("chat-read"));
    }

    const handleReceiveMessage = (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["chat", data.chatId] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });

      if (conversationId === data.chatId) {
        socket.emit("mark-as-read", { chatId: conversationId, userId });
      }
    };

    const handleMessagesRead = (data: { chatId: string; userId: string }) => {
      if (data.chatId === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["chat", data.chatId] });
      }
    };

    const handleUserOnline = (onlineUserIds: string[]) => {
      setOnlineUsers(onlineUserIds);
    };

    const handleContractCreated = () =>
      queryClient.invalidateQueries({ queryKey: ["contract"] });
    const handleContractSigned = () =>
      queryClient.invalidateQueries({ queryKey: ["contract"] });

    socket.on("receive-message", handleReceiveMessage);
    socket.on("messages-read", handleMessagesRead);
    socket.on("get-online-users", handleUserOnline);

    if (activeChat?.serviceId?._id) {
      socket.emit("join_service", activeChat.serviceId._id);
      socket.on("contract_created", handleContractCreated);
      socket.on("contract_signed", handleContractSigned);
    }

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off("messages-read", handleMessagesRead);
      socket.off("get-online-users", handleUserOnline);
      socket.off("contract_created", handleContractCreated);
      socket.off("contract_signed", handleContractSigned);
      if (conversationId) socket.emit("leave-chat", conversationId);
    };
  }, [conversationId, userId, queryClient, activeChat?.serviceId?._id]);

  // Scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sendMutation.isPending) return;
    sendMutation.mutate(
      { id: conversationId, text: newMessage.trim() },
      { onSuccess: () => setNewMessage("") },
    );
  };

  // FORMATTERS (Original logic preserved)
  const formatTime = (dateString?: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );
    if (diffHours < 24)
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    return date.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  };

  const filteredChats = chats.filter((chat: any) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Sales") return chat.providerId._id === userId;
    return chat.clientId._id === userId;
  });

  return (
    <div className="max-w-300 mx-auto my-4 h-[calc(100vh-56px)] md:h-[calc(100vh-91px)] rounded-xl bg-white overflow-hidden">
      <div className="w-full h-full flex bg-white overflow-hidden">
        {/* LEFT SIDEBAR */}
        <div
          // className={`${conversationId && isMobile ? "hidden" : "flex"} flex-col w-full xl:w-[420px] xl:min-w-[420px] xl:max-w-[420px] border-r border-[#F1F3F5] bg-white overflow-hidden transition-all`}
          className={`${conversationId && isMobile ? "hidden" : "flex"} flex-col w-full md:max-w-[360px] border-r border-[#F1F3F5] bg-white overflow-hidden transition-all`}
        >
          {/* SIDEBAR HEADER */}
          <div className="p-6 flex items-center justify-between border-b border-[#F8F9FA]">
            <h1 className="text-[24px] font-bold text-[#212529] m-0">Chat</h1>
            <button className="p-2 hover:bg-[#F8F9FA] rounded-xl transition-colors">
              <span className="material-symbols-outlined text-[#495057]">
                archive
              </span>
            </button>
          </div>

          {/* FILTER BUTTONS */}
          <div className="flex gap-2 p-4 bg-white border-b border-[#F8F9FA]">
            {(["All", "Purchases", "Sales"] as FilterType[]).map((filter) => (
              <button
                key={filter}
                className={`py-2.5 px-6 rounded-2xl text-[14px] font-semibold transition-all duration-200 ${
                  activeFilter === filter
                    ? "bg-[#212529] text-white"
                    : "bg-[#F8F9FA] text-[#495057] hover:bg-[#E9ECEF]"
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
              if (chat.clientId?._id === userId) {
                return false;
              }
              const lastCheck = localStorage.getItem(
                `lastChatCheck_${userId}_${chat._id}`,
              );
              return lastCheck
                ? new Date(chat.updatedAt) > new Date(lastCheck)
                : true;
            }}
            formatTime={formatTime}
            onlineUsers={onlineUsers}
          />
        </div>

        {/* RIGHT SIDE */}
        <div
          className={`flex-1 flex flex-col min-w-0 max-w-full bg-white lg:static lg:h-auto ${!conversationId && isMobile ? "hidden" : "flex"}`}
        >
          {!conversationId ? (
            <div className="flex flex-col items-center justify-center h-full text-[#ADB5BD] bg-[#FFFFFF]">
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm mb-6">
                <span className="material-symbols-outlined text-[40px] text-[#CED4DA]">
                  chat_bubble
                </span>
              </div>
              <p className="text-[18px] font-medium text-[#495057]">
                Velg en samtale
              </p>
              <p className="text-[14px] text-[#6C757D] mt-2 text-center max-w-[280px]">
                Velg en samtale fra listen til venstre for å begynne å chatte.
              </p>
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
                isOnline={isOtherUserOnline}
              />

              <div className="flex-1 flex flex-col min-h-0 bg-white">
                {contract && userId && (
                  <div className="px-6 py-4 border-b border-[#F8F9FA]">
                    <ContractMessage
                      contract={contract}
                      currentUserId={String(userId)}
                    />
                  </div>
                )}

                <MessageList
                  messages={messages}
                  userId={String(userId)}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  messagesEndRef={
                    messagesEndRef as React.RefObject<HTMLDivElement>
                  }
                />
              </div>

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
          currentUserId={String(userId)}
          onContractCreated={() =>
            queryClient.invalidateQueries({ queryKey: ["contract"] })
          }
        />
      )}
    </div>
  );
}
