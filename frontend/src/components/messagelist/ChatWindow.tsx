import React, { useState } from 'react';
import ChatHeader from '../../components/chat/ChatHeader';
import MessageList from '../../components/chat/MessageList';
import MessageInput from '../../components/chat/MessageInput';
import { EmptyChatState } from '../../components/chat/ChatUiComponents';
import { ChatWindowSkeleton } from '../Loading/ChatWindowSkeleton';
import { Briefcase, X, Check, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useMutation } from '@tanstack/react-query';
import { createContract, createPaymentSession, updateAgreedPrice } from '../../api/chatAPI';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '../../components/Ui/sheet';

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

const getChatStatusLabel = (chatStatus?: string) => {
  switch (chatStatus) {
    case 'requested':
      return 'Forespørsel';
    case 'agreed':
      return 'Avtalt';
    case 'paid':
      return 'Betalt';
    case 'contracted':
      return 'Kontrakt signert';
    case 'completed':
      return 'Fullført';
    case 'cancelled':
      return 'Kansellert';
    default:
      return 'Forespørsel';
  }
};

const getOrderStage = (status: string, paymentStatus: string) => {
  if (status === 'completed') return 'Fullført';
  if (status === 'in_progress') return 'Pågår';
  if (paymentStatus === 'paid') return 'Betalt';
  if (status === 'awaiting_payment') return 'Venter på betaling';
  if (status === 'accepted') return 'Godtatt';
  if (status === 'pending') return 'Ventende';
  if (status === 'cancelled') return 'Kansellert';
  if (status === 'declined') return 'Avslått';
  return 'Forespørsel';
};

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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isEditingPrice, setIsEditingPrice] = useState(false);
  const [newAgreedPrice, setNewAgreedPrice] = useState<string>('');

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
      if (activeChat.orderId.paymentStatus === 'paid') {
        navigate(`/safepay/approval/${orderId}`);
      } else {
        createPaymentSessionMutation.mutate();
      }
    } else {
      toast('Du må opprette kontrakt først!');
    }
  };

  const updateAgreedPriceMutation = useMutation({
    mutationFn: (price: number) => updateAgreedPrice(activeChat._id, price),
    onSuccess: (data) => {
      toast.success('Pris avtalt!');
      setIsEditingPrice(false);
      setNewAgreedPrice('');
      refetchActiveChat?.();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Kunne ikke oppdatere pris');
    },
  });

  const handleUpdateAgreedPrice = () => {
    const price = Number(newAgreedPrice);
    if (isNaN(price) || price < 0) {
      toast.error('Ugyldig pris');
      return;
    }
    updateAgreedPriceMutation.mutate(price);
  };

  // Check if chat is ready for action bar
  const isChatReady =
    activeChat?.status === 'agreed' || activeChat?.agreedPrice !== undefined || activeChat?.orderId;

  const handleSystemMessageClick = (msg: any) => {
    if (msg.systemData?.orderId) {
      navigate(`/safepay/checkout/${msg.systemData.orderId}`);
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
          />

          {activeChat?.serviceId && (
            <>
              {/* Sticky Job Header */}
              <div
                className="bg-white border-b border-black/[0.06] px-[18px] py-[12px] shrink-0 cursor-pointer hover:bg-[#f9f9f7] transition-colors sticky top-0 z-10"
                onClick={() => setSheetOpen(true)}
              >
                <div className="flex items-start gap-[12px]">
                  {/* Image */}
                  <div className="w-[60px] h-[60px] flex-shrink-0 bg-gray-100 rounded-[8px] overflow-hidden">
                    {activeChat.serviceId.images && activeChat.serviceId.images.length > 0 ? (
                      <img
                        src={activeChat.serviceId.images[0]}
                        alt={activeChat.serviceId.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#f0faf0]">
                        <Briefcase size={24} className="text-[#16a34a]" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-[13px] font-semibold text-custom-black truncate">
                          {activeChat.serviceId.title || 'Oppdrag'}
                        </h4>
                        {activeChat.serviceId.categories &&
                          activeChat.serviceId.categories.length > 0 && (
                            <p className="text-[11px] text-gray-500 mt-[1px] truncate">
                              {activeChat.serviceId.categories.join(', ')}
                            </p>
                          )}
                        <div className="flex items-center gap-2 mt-[2px]">
                          {/* Original service price (if agreed price exists) */}
                          {activeChat.agreedPrice !== undefined && (
                            <p className="text-[12px] text-gray-400 line-through">
                              {activeChat.serviceId.price ? `${activeChat.serviceId.price} kr` : ''}
                            </p>
                          )}
                          {/* Agreed price or original price input */}
                          {isEditingPrice ? (
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                value={newAgreedPrice}
                                onChange={(e) => setNewAgreedPrice(e.target.value)}
                                placeholder="Pris"
                                className="w-[80px] border border-gray-300 rounded px-2 py-1 text-sm"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateAgreedPrice();
                                  }
                                }}
                              />
                              <button
                                onClick={handleUpdateAgreedPrice}
                                className="p-1 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={() => setIsEditingPrice(false)}
                                className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <p className="text-[12px] font-bold text-[#16a34a]">
                              {activeChat.agreedPrice ?? activeChat.serviceId.price} kr
                            </p>
                          )}
                          {/* Edit price button (only if no contract created yet) */}
                          {!activeChat.orderId && !isEditingPrice && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsEditingPrice(true);
                                setNewAgreedPrice(
                                  (activeChat.agreedPrice ?? activeChat.serviceId.price).toString()
                                );
                              }}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                        <span className="inline-block mt-[4px] px-[8px] py-[2px] rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                          {activeChat.status
                            ? getChatStatusLabel(activeChat.status)
                            : activeChat.orderId
                              ? getOrderStage(
                                  activeChat.orderId.status,
                                  activeChat.orderId.paymentStatus
                                )
                              : 'Forespørsel'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* In-thread Action Bar (only show if chat is ready) */}
              {isChatReady && (
                <div className="bg-white border-b border-black/[0.06] px-[18px] py-[10px] shrink-0">
                  <div className="flex gap-[8px]">
                    {!activeChat.orderId ? (
                      <button
                        onClick={handleCreateContract}
                        className="flex-1 px-[12px] py-[8px] rounded-full text-[11px] font-semibold cursor-pointer border-none bg-[#16a34a] text-white hover:bg-[#138e3f] transition-colors"
                      >
                        Opprett kontrakt
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={handleStartSafePay}
                          className="flex-1 px-[12px] py-[8px] rounded-full text-[11px] font-semibold cursor-pointer border-none bg-[#16a34a] text-white hover:bg-[#138e3f] transition-colors"
                        >
                          Start fiks ferdig-betaling
                        </button>
                        <button
                          onClick={() => {
                            const orderId = activeChat.orderId._id || activeChat.orderId;
                            navigate(`/safepay/checkout/${orderId}`);
                          }}
                          className="flex-1 px-[12px] py-[8px] rounded-full text-[11px] font-semibold cursor-pointer border border-[#16a34a] text-[#16a34a] bg-white hover:bg-gray-50 transition-colors"
                        >
                          Se kontrakt
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Job Detail Sheet */}
          {activeChat?.serviceId && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetContent side="bottom" className="h-[80vh] rounded-t-[20px] px-0">
                <SheetHeader className="px-[18px] pb-2 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-lg font-semibold">Oppdrag</SheetTitle>
                    <SheetClose className="rounded-full p-1 hover:bg-gray-100">
                      <X size={20} />
                    </SheetClose>
                  </div>
                </SheetHeader>
                <div className="px-[18px] py-4 overflow-y-auto">
                  {activeChat.serviceId.images && activeChat.serviceId.images.length > 0 && (
                    <div className="w-full h-[200px] rounded-[12px] overflow-hidden mb-4">
                      <img
                        src={activeChat.serviceId.images[0]}
                        alt={activeChat.serviceId.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <h2 className="text-xl font-bold text-custom-black mb-2">
                    {activeChat.serviceId.title}
                  </h2>
                  {activeChat.serviceId.categories &&
                    activeChat.serviceId.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {activeChat.serviceId.categories.map((cat: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  <p className="text-2xl font-bold text-[#16a34a] mb-4">
                    {activeChat.agreedPrice ?? activeChat.serviceId.price} kr
                  </p>
                  {activeChat.serviceId.description && (
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {activeChat.serviceId.description}
                    </p>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <MessageList
              messages={messages}
              userId={String(userId)}
              formatTime={formatTime}
              messagesEndRef={messagesEndRef}
              onSystemMessageClick={handleSystemMessageClick}
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
