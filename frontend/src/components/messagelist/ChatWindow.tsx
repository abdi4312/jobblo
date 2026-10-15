import React from 'react';
import ChatHeader from '../../components/chat/ChatHeader';
import MessageList from '../../components/chat/MessageList';
import MessageInput from '../../components/chat/MessageInput';
import { EmptyChatState } from '../../components/chat/ChatUiComponents';
import { ChatWindowSkeleton } from '../Loading/ChatWindowSkeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { createContract, createPaymentSession } from '../../api/chatAPI';
import { customerOrderPath } from '../../constants/statuses';

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
  refetchActiveChat?: () => void;
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
  refetchActiveChat,
}) => {
  const navigate = useNavigate();
  // Three `console.log`s used to run here on every render, dumping the whole chat object
  // — both parties, the order, the agreed price — into the browser console of every
  // production user. Removed.
  const createContractMutation = useMutation({
    mutationFn: () =>
      createContract(activeChat._id, activeChat.agreedPrice || activeChat.serviceId.price),
    onSuccess: (data) => {
      toast.success('Kontrakt opprettet!');
      refetchActiveChat?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Kunne ikke opprette kontrakt');
    },
  });

  const handleCreateContract = () => {
    if (!activeChat?._id) {
      toast.error('Mangler info for å opprette kontrakt');
      return;
    }
    createContractMutation.mutate();
  };

  const createPaymentSessionMutation = useMutation({
    mutationFn: () => createPaymentSession(activeChat._id),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Kunne ikke starte betaling');
    },
  });

  const handleStartSafePay = () => {
    if (activeChat?.orderId?._id || activeChat?.orderId) {
      const orderId = activeChat.orderId._id || activeChat.orderId;
      // ponytail BUG-005: customer goes to approval/checkout pages (or starts payment session); provider always goes to their work page
      if (isServiceOwner) {
        if (activeChat.orderId.paymentStatus === 'paid') {
          navigateToOrder(orderId, { preferApprovalWhenPaid: true });
        } else {
          createPaymentSessionMutation.mutate();
        }
      } else {
        // Provider always goes to their work page
        navigateToOrder(orderId);
      }
    } else {
      toast('Du må opprette kontrakt først!');
    }
  };

  // Check if current user is service owner (customer).
  // (F-52) `serviceId.userId` was never selected by any of chatController's populate
  // projections, so this was permanently false: the customer never saw the "Opprett
  // kontrakt" / "Start fiks ferdig-betaling" action bar, and navigateToOrder routed
  // *everyone* — customers included — to the provider work page. The projections now
  // include userId; String() guards against an ObjectId/string mismatch.
  const serviceOwnerId = activeChat?.serviceId?.userId;
  const isServiceOwner = !!serviceOwnerId && String(serviceOwnerId) === String(userId);

  // ponytail: shared helper for order-based navigation (BUG-005 fix).
  // Customer (service owner) → /safepay/* pages (payment / approval / checkout)
  // Provider (applicant) → /provider/orders/:orderId (their active work page)
  // Without this, providers land on the customer-side payment/approval screens
  // and get stuck (no link back to their checklist / progress).
  const navigateToOrder = (
    orderIdInput: string,
    opts: { preferApprovalWhenPaid?: boolean } = {}
  ) => {
    const id = orderIdInput;
    if (!id) return;
    const order = activeChat?.orderId;
    // Default to provider work page when viewer is NOT customer (aka provider)
    const viewerIsProvider = !isServiceOwner;
    if (viewerIsProvider) {
      navigate(`/provider/orders/${id}`);
      return;
    }
    // Customer side routing. `preferApprovalWhenPaid` used to mean literally that —
    // paid ⇒ approval screen — which showed "utfører melder jobben som ferdig" to a
    // customer whose provider had not even started. Approval is only a destination
    // once the order actually reaches `ready_for_review`.
    const orderObj = typeof order === 'object' ? (order as { paymentStatus?: string; status?: string }) : undefined;
    const approvalPath = opts.preferApprovalWhenPaid
      ? customerOrderPath(id, orderObj?.status)
      : null;
    if (approvalPath) {
      navigate(approvalPath);
    } else if (opts.preferApprovalWhenPaid && orderObj?.paymentStatus === 'paid') {
      navigate(`/safepay/success?orderId=${id}`);
    } else {
      navigate(`/safepay/checkout/${id}`);
    }
  };

  // Check if chat is ready for action bar
  const isChatReady =
    activeChat?.status === 'agreed' || activeChat?.agreedPrice !== undefined || activeChat?.orderId;

  const handleSystemMessageClick = (msg: any) => {
    if (msg.systemData?.orderId) {
      // ponytail BUG-005: route to correct viewer's page (provider → work page)
      navigateToOrder(msg.systemData.orderId);
    }
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
            chatId={activeChat?._id}
          />

          {activeChat?.serviceId && (
            <>
              {/* In-thread Action Bar */}
              {isServiceOwner && isChatReady && (
                <div className="bg-white border-b border-gray-100 px-4 py-3 shrink-0">
                  <div className="flex gap-3">
                    {!activeChat.orderId ? (
                      <button
                        onClick={handleCreateContract}
                        className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none bg-linear-to-r from-[#2E6641] to-[#15803d] text-white shadow-sm hover:shadow-md hover:from-[#15803d] hover:to-[#14532d] transition-all duration-200 transform hover:-translate-y-0.5"
                      >
                        Opprett kontrakt
                      </button>
                    ) : (
                      activeChat.orderId.paymentStatus !== 'paid' && (
                        <button
                          onClick={handleStartSafePay}
                          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none bg-linear-to-r from-[#2E6641] to-[#15803d] text-white shadow-sm hover:shadow-md hover:from-[#15803d] hover:to-[#14532d] transition-all duration-200 transform hover:-translate-y-0.5"
                        >
                          Start fiks ferdig-betaling
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <MessageList
              messages={messages}
              userId={String(userId)}
              formatTime={formatTime}
              messagesEndRef={messagesEndRef}
              onSystemMessageClick={handleSystemMessageClick}
              chatId={activeChat?._id}
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
