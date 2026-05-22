import { useChatLogic } from "../../features/chat/useChatLogic";
import { ChatSidebar } from "../../components/messagelist/ChatSidebar";
import { ChatWindow } from "../../components/messagelist/ChatWindow";

/**
 * Main chat page component with split view for desktop and full screen for mobile
 */
export function MessagesPageSplit() {
  const {
    conversationId,
    queryClient,
    messagesEndRef,
    activeFilter,
    setActiveFilter,
    newMessage,
    setNewMessage,
    isMobile,
    userId,
    user,
    onlineUsers,
    chatsQuery,
    activeChatQuery,
    sendMutation,
    activeChat,
    messages,
    otherUser,
    isOtherUserOnline,
    handleSend,
    formatTime,
    filteredChats,
    isUnread,
  } = useChatLogic();

  return (
    <div className="max-w-300 mx-auto my-4 h-[calc(100vh-56px)] md:h-[calc(100vh-91px)] rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <div className="w-full h-full flex box-card-custom overflow-hidden">
        <ChatSidebar
          conversationId={conversationId}
          isMobile={isMobile}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          chatsLoading={chatsQuery.isLoading}
          filteredChats={filteredChats}
          user={user}
          isUnread={isUnread}
          formatTime={formatTime}
          onlineUsers={onlineUsers}
        />

        <ChatWindow
          conversationId={conversationId}
          isMobile={isMobile}
          activeChatLoading={activeChatQuery.isLoading}
          otherUser={otherUser}
          isOtherUserOnline={isOtherUserOnline}
          activeChat={activeChat}
          userId={String(userId)}
          messages={messages}
          formatTime={formatTime}
          messagesEndRef={messagesEndRef}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          handleSend={handleSend}
          sending={sendMutation.isPending}
        />
      </div>
    </div>
  );
}
