import React from 'react';
import ChatHeader from '../../components/chat/ChatHeader';
import MessageList from '../../components/chat/MessageList';
import MessageInput from '../../components/chat/MessageInput';
import { EmptyChatState } from '../../components/chat/ChatUiComponents';
import { ChatWindowSkeleton } from '../Loading/ChatWindowSkeleton';
import { Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

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
  const navigate = useNavigate();

  const handleSeOppdrag = () => {
    if (activeChat?.serviceId?._id) {
      navigate(`/job-listing/${activeChat.serviceId._id}`);
    }
  };

  const handleStartSafePay = () => {
    toast('SafePay flow coming soon!');
  };

  return (
    <div
      className={`flex-1 flex flex-col min-w-0 ${!conversationId && isMobile ? 'hidden' : 'flex'}`}
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

          {activeChat?.serviceId && (
            <div className="bg-white border-b border-black/[0.06] px-[18px] py-[9px] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-[9px]">
                <div className="w-[28px] h-[28px] bg-[#f0faf0] rounded-[7px] flex items-center justify-center">
                  <Briefcase size={14} className="text-[#16a34a]" />
                </div>
                <div className="flex flex-col">
                  <div className="text-[12px] font-medium text-custom-black">
                    {activeChat.serviceId.title || 'Oppdrag'}
                  </div>
                  <div className="text-[11px] text-[#888]">
                    {activeChat.serviceId.price ? `${activeChat.serviceId.price} kr` : ''}
                  </div>
                </div>
              </div>
              <div className="flex gap-[7px]">
                <button
                  onClick={handleSeOppdrag}
                  className="px-[12px] py-[5px] rounded-full text-[11px] font-medium cursor-pointer border border-black/[0.15] bg-transparent text-custom-black hover:bg-[#f9f9f7] transition-colors"
                >
                  Se oppdrag
                </button>
                <button
                  onClick={handleStartSafePay}
                  className="px-[12px] py-[5px] rounded-full text-[11px] font-medium cursor-pointer border-none bg-[#16a34a] text-white hover:bg-[#138e3f] transition-colors"
                >
                  Start SafePay
                </button>
              </div>
            </div>
          )}

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
