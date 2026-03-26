import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";
import { getChatById, sendMessage, type Chat, type ChatMessage } from "../../api/chatAPI";
import { initSocket } from "../../socket/socket";
import { toast } from "react-hot-toast";

export function ConversationView() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [chat, setChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) return;

    const fetchChat = async () => {
      try {
        setLoading(true);
        const data = await getChatById(conversationId);
        setChat(data);
      } catch (error) {
        console.error("Error fetching chat:", error);
        toast.error("Kunne ikke laste chat");
        navigate("/messages");
      } finally {
        setLoading(false);
      }
    };

    fetchChat();

    const socket = initSocket();
    socket.emit("join-chat", conversationId);

    const handleReceiveMessage = (data: { chatId: string; message: ChatMessage }) => {
      if (data.chatId === conversationId) {
        setChat((prev) => {
          if (!prev) return prev;
          // Check for duplicates
          if (prev.messages.some((m) => m._id === data.message._id)) return prev;
          return {
            ...prev,
            messages: [...prev.messages, data.message],
          };
        });
      }
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.emit("leave-chat", conversationId);
      socket.off("receive-message", handleReceiveMessage);
    };
  }, [conversationId, navigate]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !conversationId) return;

    try {
      const sentMessage = await sendMessage(conversationId, message.trim());
      setChat((prev) => {
        if (!prev) return prev;
        if (prev.messages.some(m => m._id === sentMessage._id)) return prev;
        return {
          ...prev,
          messages: [...prev.messages, sentMessage],
        };
      });
      setMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Kunne ikke sende melding");
    }
  };

  if (loading) return <div>Laster chat...</div>;
  if (!chat) return <div>Chat ikke funnet</div>;

  return (
    <div className="conversation-view">
      <div className="messages">
        {chat.messages.map((m, idx) => (
          <div key={m._id || idx} className={`message ${m.senderId === user?._id ? "own" : "other"}`}>
            {m.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSend}>
        <input value={message} onChange={(e) => setMessage(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
