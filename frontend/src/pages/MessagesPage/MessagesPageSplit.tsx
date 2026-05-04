import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChatSocket } from "../../features/chat/useChatSocket";

// Components
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import ConversationList from "../../components/chat/ConversationList";
import { ContractMessage } from "../../components/chat/ContractMessage/ContractMessage";
import { CreateContractModal } from "../../components/chat/CreateContractModal/CreateContractModal";
import { FilterButton, EmptyChatState } from "../../components/chat/ChatUiComponents";
import { useQueryClient } from "@tanstack/react-query";

type FilterType = "All" | "Purchases" | "Sales";

/**
 * Main chat page component with split view for desktop and full screen for mobile
 */
export function MessagesPageSplit() {
  const { conversationId } = useParams();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [newMessage, setNewMessage] = useState("");
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1200);

  const {
    userId,
    user,
    onlineUsers,
    chatsQuery,
    activeChatQuery,
    contractQuery,
    sendMutation,
    playSendSound,
  } = useChatSocket(conversationId);

  const chats = chatsQuery.data || [];
  const activeChat = activeChatQuery.data;
  const messages = activeChat?.messages || [];
  const contract = contractQuery.data;

  const otherUser = activeChat
    ? activeChat.clientId?._id === userId
      ? activeChat.providerId
      : activeChat.clientId
    : null;

  const isOtherUserOnline = !!(otherUser?._id && onlineUsers.includes(otherUser._id));

  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1200);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll to latest message
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
      {
        onSuccess: () => {
          setNewMessage("");
          playSendSound();
        },
      }
    );
  };

  const formatTime = (dateString?: string): string => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffHours < 24) return date.toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit", hour12: false });
    return date.toLocaleDateString("no-NO", { day: "2-digit", month: "short" });
  };

  const filteredChats = chats.filter((chat) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Sales") return chat.providerId?._id === userId;
    return chat.clientId?._id === userId;
  });

  return (
    <div className="max-w-300 mx-auto my-4 h-[calc(100vh-56px)] md:h-[calc(100vh-91px)] rounded-xl bg-white overflow-hidden shadow-sm border border-gray-100">
      <div className="w-full h-full flex bg-white overflow-hidden">
        {/* Sidebar - Hidden on mobile if a conversation is active */}
        <div className={`${conversationId && isMobile ? "hidden" : "flex"} flex-col w-full md:max-w-[360px] border-r border-[#F1F3F5] bg-white overflow-hidden`}>
          <div className="p-6 flex items-center justify-between border-b border-[#F8F9FA]">
            <h1 className="text-[24px] font-bold text-[#212529] m-0">Chat</h1>
          </div>

          <div className="flex gap-2 p-4 bg-white border-b border-[#F8F9FA]">
            {(["All", "Purchases", "Sales"] as FilterType[]).map((filter) => (
              <FilterButton
                key={filter}
                label={filter}
                isActive={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              />
            ))}
          </div>

          <ConversationList
            loading={chatsQuery.isLoading}
            filteredChats={filteredChats}
            user={user}
            conversationId={conversationId}
            isUnread={(chat) => {
              const lastMsg = chat.messages?.[chat.messages.length - 1];
              if (!lastMsg || !userId) return false;
              const senderId = typeof lastMsg.senderId === "string" ? lastMsg.senderId : lastMsg.senderId?._id;
              if (senderId === userId) return false;
              return !lastMsg.seenBy?.some((id: any) => (id?._id || id) === userId);
            }}
            formatTime={formatTime}
            onlineUsers={onlineUsers}
          />
        </div>

        {/* Chat Area - Hidden on mobile if no conversation is active */}
        <div className={`flex-1 flex flex-col min-w-0 bg-white ${!conversationId && isMobile ? "hidden" : "flex"}`}>
          {!conversationId ? (
            <EmptyChatState />
          ) : activeChatQuery.isLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400 animate-pulse">Laster samtale...</div>
          ) : (
            <>
              <ChatHeader
                isMobile={isMobile}
                otherUser={otherUser ?? undefined}
                contract={contract ?? undefined}
                setShowCreateContract={setShowCreateContract}
                isOnline={isOtherUserOnline}
                hasService={!!activeChat?.serviceId?._id}
              />

              <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
                {contract && userId && (
                  <div className="px-6 py-4 border-b border-[#F8F9FA]">
                    <ContractMessage contract={contract} currentUserId={String(userId)} />
                  </div>
                )}

                <MessageList
                  messages={messages}
                  userId={String(userId)}
                  formatTime={formatTime}
                  messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
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

      {showCreateContract && userId && otherUser && activeChat?.serviceId?._id && (
        <CreateContractModal
          isOpen={showCreateContract}
          onClose={() => setShowCreateContract(false)}
          serviceId={activeChat.serviceId._id}
          serviceTitle={activeChat.serviceId.title || "Service"}
          otherUserId={otherUser._id}
          currentUserId={String(userId)}
          onContractCreated={() => queryClient.invalidateQueries({ queryKey: ["contract"] })}
        />
      )}
    </div>
  );
}
