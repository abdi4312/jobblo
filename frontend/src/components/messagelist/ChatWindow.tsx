import React from "react";
import ChatHeader from "../../components/chat/ChatHeader";
import MessageList from "../../components/chat/MessageList";
import MessageInput from "../../components/chat/MessageInput";
import { ContractMessage } from "../../components/chat/ContractMessage/ContractMessage";
import { EmptyChatState } from "../../components/chat/ChatUiComponents";

interface ChatWindowProps {
  conversationId?: string;
  isMobile: boolean;
  activeChatLoading: boolean;
  otherUser: any;
  contract: any;
  setShowCreateContract: (show: boolean) => void;
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
  contract,
  setShowCreateContract,
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
    <div className={`flex-1 flex flex-col min-w-0 ${!conversationId && isMobile ? "hidden" : "flex"}`}>
      {!conversationId ? (
        <EmptyChatState />
      ) : activeChatLoading ? (
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

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {contract && userId && (
              <div className="px-6 py-4 border-b border-[#F8F9FA] rounded-none">
                <ContractMessage contract={contract} currentUserId={String(userId)} />
              </div>
            )}

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
