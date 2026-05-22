import React from "react";
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import { EmptyChatState } from "../../components/chat/ChatUiComponents";
import { ChatWindowSkeleton } from "../Loading/ChatWindowSkeleton";

interface ChatWindowProps {
  conversationId?: string;
  isMobile: boolean;
  activeChatLoading: boolean;
  otherUser: any;
  isOtherUserOnline: boolean;
  activeChat: any;
  userId: string;
  messages: any[];
  formatTime: (date?: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  newMessage: string;
  setNewMessage: (msg: string) => void;
  handleSend: () => void;
  sending: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  isMobile,
  activeChatLoading,
  otherUser,
  isOtherUserOnline,
  activeChat,
  userId,
  messages,
  formatTime,
  messagesEndRef,
  newMessage,
  setNewMessage,
  handleSend,
  sending,
}) => {
  return (
    <div
      className={`flex-1 flex flex-col min-w-0 ${!conversationId && isMobile ? "hidden" : "flex"}`}
    >
      {!conversationId ? (
        <EmptyChatState />
      ) : activeChatLoading ? (
        <ChatWindowSkeleton />
      ) : (
        <>
          <ChatHeader
            isMobile={isMobile}
            otherUser={otherUser ?? undefined}
            isOnline={isOtherUserOnline}
            hasService={!!activeChat?.serviceId?._id}
          />

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            <MessageList
              messages={messages}
              userId={String(userId)}
              formatTime={formatTime}
              messagesEndRef={messagesEndRef}
            />
          </div>

          <MessageInput
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSend={handleSend}
            sending={sending}
          />
        </>
      )}
    </div>
  );
};
