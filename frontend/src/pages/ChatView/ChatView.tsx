import { useState, useEffect, useRef } from 'react';
import { dateFormatter } from '../../utils/dateFormatter';
import { timeFormatter } from '../../utils/timeFormatter';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../../stores/userStore';
import { getChatById, sendMessage, type Chat, type ChatMessage } from '../../api/chatAPI';
import { initSocket } from '../../socket/socket';
import { toast } from 'react-hot-toast';
import styles from './ChatView.module.css';
import { ProfileTitleWrapper } from '../../components/layout/body/profile/ProfileTitleWrapper';
import { Briefcase, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { createContract } from '../../api/safePayAPI';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '../../components/Ui/sheet';

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

export function ChatView() {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  // Debug: Log chat data
  const [chat, setChat] = useState<Chat | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const otherUser = chat
    ? chat.clientId._id === user?._id
      ? chat.providerId
      : chat.clientId
    : null;

  useEffect(() => {
    if (!chatId) return;

    const fetchChat = async () => {
      try {
        setLoading(true);
        const chatData = await getChatById(chatId);
        console.log('ChatView - Fetched chat data:', chatData);
        console.log('ChatView - serviceId:', chatData.serviceId);
        console.log('ChatView - serviceId.images:', chatData.serviceId?.images);
        setChat(chatData);
      } catch (error) {
        console.error('Error fetching chat:', error);
        toast.error('Kunne ikke laste samtale');
        navigate('/messages');
      } finally {
        setLoading(false);
      }
    };

    fetchChat();
  }, [chatId, navigate]);

  useEffect(() => {
    if (!chatId) return;

    const socket = initSocket();

    // Join the chat room
    socket.emit('join-chat', chatId);

    // Listen for new messages
    const handleReceiveMessage = (data: { chatId: string; message: ChatMessage }) => {
      if (data.chatId === chatId) {
        setChat((prevChat) => {
          if (!prevChat) return prevChat;

          const exists = prevChat.messages.some(
            (m) =>
              (m._id && m._id === data.message._id) ||
              (m.createdAt === data.message.createdAt &&
                m.text === data.message.text &&
                m.senderId === data.message.senderId)
          );

          if (exists) return prevChat;

          return {
            ...prevChat,
            messages: [...prevChat.messages, data.message],
            lastMessage: data.message.text,
          };
        });
      }
    };

    socket.on('receive-message', handleReceiveMessage);

    return () => {
      socket.emit('leave-chat', chatId);
      socket.off('receive-message', handleReceiveMessage);
    };
  }, [chatId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !chatId || sending) return;

    try {
      setSending(true);
      const newMessage = await sendMessage(chatId, messageText.trim());

      setChat((prevChat) => {
        if (!prevChat) return prevChat;

        // Check if socket already added it to prevent double-display
        const exists = prevChat.messages.some((m) => m._id === newMessage._id);
        if (exists) return prevChat;

        return {
          ...prevChat,
          messages: [...prevChat.messages, newMessage],
          lastMessage: newMessage.text,
        };
      });

      setMessageText('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Kunne ikke sende melding');
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    return `${dateFormatter.toRelative(dateString)} ${timeFormatter.toShortTime(dateString)}`;
  };

  const createContractMutation = useMutation({
    mutationFn: () =>
      createContract({
        serviceId: chat!.serviceId._id,
        applicantId: otherUser!._id,
      }),
    onSuccess: (data) => {
      toast.success('Kontrakt opprettet!');
      navigate(`/safepay/checkout/${data.orderId}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Kunne ikke opprette kontrakt');
    },
  });

  const handleCreateContract = () => {
    if (!chat?.serviceId?._id || !otherUser?._id) {
      toast.error('Mangler info for å opprette kontrakt');
      return;
    }
    createContractMutation.mutate();
  };

  const handleStartSafePay = () => {
    if (chat?.orderId?._id || chat?.orderId) {
      const orderId = chat.orderId._id || chat.orderId;
      if (chat.orderId.paymentStatus === 'paid') {
        navigate(`/safepay/approval/${orderId}`);
      } else {
        navigate(`/safepay/checkout/${orderId}`);
      }
    } else {
      toast('SafePay flow coming soon! You need to create a contract first!');
    }
  };

  const handleSystemMessageClick = (msg: ChatMessage) => {
    if (msg.systemData?.orderId) {
      navigate(`/safepay/checkout/${msg.systemData.orderId}`);
    }
  };

  const getSystemIcon = (type?: string) => {
    switch (type) {
      case 'contract':
        return <Briefcase size={14} />;
      case 'payment':
        return <Briefcase size={14} />;
      default:
        return <Briefcase size={14} />;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Laster samtale...</div>
      </div>
    );
  }

  if (!chat) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Samtale ikke funnet</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ProfileTitleWrapper title={otherUser?.name || 'Chat'} buttonText="Tilbake" />

      {chat?.serviceId && (
        <>
          {/* Sticky Job Header */}
          <div
            className="bg-white border-b border-black/[0.06] px-[18px] py-[12px] shrink-0 cursor-pointer hover:bg-[#f9f9f7] transition-colors sticky top-0 z-10"
            onClick={() => setSheetOpen(true)}
          >
            <div className="flex items-start gap-[12px]">
              {/* Image */}
              <div className="w-[60px] h-[60px] flex-shrink-0 bg-gray-100 rounded-[8px] overflow-hidden">
                {(chat.serviceId.images && chat.serviceId.images.length > 0) ||
                chat.serviceId.image ? (
                  <img
                    src={
                      chat.serviceId.images && chat.serviceId.images.length > 0
                        ? chat.serviceId.images[0]
                        : chat.serviceId.image
                    }
                    alt={chat.serviceId.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      console.error('ChatView - Image failed to load:', e.currentTarget.src);
                      const parent = e.currentTarget.parentElement;
                      if (parent) {
                        parent.innerHTML =
                          '<div class="w-full h-full flex items-center justify-center bg-[#f0faf0]"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg></div>';
                      }
                    }}
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
                      {chat.serviceId.title || 'Oppdrag'}
                    </h4>
                    {chat.serviceId.categories && chat.serviceId.categories.length > 0 && (
                      <p className="text-[11px] text-gray-500 mt-[1px] truncate">
                        {chat.serviceId.categories.join(', ')}
                      </p>
                    )}
                    <p className="text-[12px] font-medium text-[#16a34a] mt-[2px]">
                      {chat.serviceId.price ? `${chat.serviceId.price} kr` : ''}
                    </p>
                    <span className="inline-block mt-[4px] px-[8px] py-[2px] rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                      {chat.orderId
                        ? getOrderStage(chat.orderId.status, chat.orderId.paymentStatus)
                        : 'Forespørsel'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* In-thread Action Bar */}
          <div className="bg-white border-b border-gray-100 px-4 py-3 shrink-0">
            <div className="flex gap-3">
              {!chat.orderId ? (
                <button
                  onClick={handleCreateContract}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white shadow-sm hover:shadow-md hover:from-[#15803d] hover:to-[#14532d] transition-all duration-200 transform hover:-translate-y-0.5"
                >
                  Opprett kontrakt
                </button>
              ) : (
                <>
                  {/* Only show payment button if payment isn't completed yet */}
                  {chat.orderId.paymentStatus !== 'paid' && (
                    <button
                      onClick={handleStartSafePay}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-none bg-gradient-to-r from-[#16a34a] to-[#15803d] text-white shadow-sm hover:shadow-md hover:from-[#15803d] hover:to-[#14532d] transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      Start fiks ferdig-betaling
                    </button>
                  )}
                  {/* Always show view contract button unless order is canceled/declined */}
                  {chat.orderId.status !== 'canceled' && chat.orderId.status !== 'declined' && (
                    <button
                      onClick={() => {
                        const orderId = chat.orderId._id || chat.orderId;
                        navigate(`/safepay/checkout/${orderId}`);
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer border-2 border-[#16a34a] text-[#16a34a] bg-white hover:bg-[#f0fdf4] transition-all duration-200 transform hover:-translate-y-0.5"
                    >
                      Se kontrakt
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Job Detail Sheet */}
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
            {((chat.serviceId.images && chat.serviceId.images.length > 0) ||
              chat.serviceId.image) && (
              <div className="w-full h-[200px] rounded-[12px] overflow-hidden mb-4">
                <img
                  src={
                    chat.serviceId.images && chat.serviceId.images.length > 0
                      ? chat.serviceId.images[0]
                      : chat.serviceId.image
                  }
                  alt={chat.serviceId.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('ChatView Sheet - Image failed to load:', e.currentTarget.src);
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <h2 className="text-xl font-bold text-custom-black mb-2">{chat.serviceId.title}</h2>
            {chat.serviceId.categories && chat.serviceId.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {chat.serviceId.categories.map((cat, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
            <p className="text-2xl font-bold text-[#16a34a] mb-4">{chat.serviceId.price} kr</p>
            {chat.serviceId.description && (
              <p className="text-gray-700 text-sm leading-relaxed">{chat.serviceId.description}</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <div className={styles.chatContainer}>
        <div className={styles.messagesContainer}>
          {chat.messages.length === 0 ? (
            <div className={styles.emptyState}>
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '48px', color: '#ccc' }}
              >
                chat_bubble_outline
              </span>
              <p>Ingen meldinger ennå. Send den første!</p>
            </div>
          ) : (
            chat.messages.map((msg, index) => {
              if (msg.type === 'system') {
                return (
                  <div
                    key={msg._id || index}
                    className="flex justify-center mb-3"
                    onClick={() => handleSystemMessageClick(msg)}
                  >
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 text-[#666] text-[12px] cursor-pointer hover:bg-white transition-colors">
                      {getSystemIcon(msg.systemData?.type)}
                      {msg.text}
                    </div>
                  </div>
                );
              }

              const senderId =
                typeof msg.senderId === 'string'
                  ? msg.senderId
                  : (msg.senderId as { _id?: string })?._id;
              const isOwnMessage = senderId === user?._id;
              return (
                <div
                  key={msg._id || index}
                  className={`${styles.messageWrapper} ${isOwnMessage ? styles.own : styles.other}`}
                >
                  <div className={styles.messageBubble}>
                    <p className={styles.messageText}>{msg.text}</p>
                    <span className={styles.messageTime}>{formatMessageTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className={styles.inputContainer}>
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Skriv en melding..."
            className={styles.messageInput}
            disabled={sending}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!messageText.trim() || sending}
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
