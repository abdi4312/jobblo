import React, { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import axios from 'axios';
import ChatWindow from '../../components/chat/ChatWindow/ChatMessage';
import ChatListItem from '../../components/chat/ChatList/ChatList';
import { useUserStore } from "../../stores/userStore";
import styles from './ChatInterface.module.css';

// Types
interface Chat {
  _id: string;
  lastMessage?: string;
  [key: string]: any;
}

interface MessageData {
  chatId: string;
  message: {
    text: string;
    [key: string]: any;
  };
}

// Socket connection
const socket: Socket = io("http://localhost:5001");

const ChatInterface: React.FC = () => {
  const userToken = useUserStore((state) => state.tokens);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [token] = useState<string | undefined>(userToken?.accessToken);

  // Fetch chats from backend
  useEffect(() => {
    if (token) {
      axios.get('http://localhost:5001/api/chats/get', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          if (Array.isArray(res.data)) {
            setChats(res.data);
          } else if (res.data.chats && Array.isArray(res.data.chats)) {
            setChats(res.data.chats);
          }
        })
        .catch(err => {
          console.error(err);
          setChats([]);
        });
    }
  }, [token]);

  // Socket connect
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      if (token) socket.emit("user:connect", { token });
    };

    socket.on("connect", handleConnect);
    if (socket.connected) handleConnect();

    return () => socket.off("connect", handleConnect);
  }, [token]);

  // Receive real-time messages
  useEffect(() => {
    const handleReceiveMessage = (data: MessageData) => {
      setChats((prevChats) =>
        prevChats.map(c => c._id === data.chatId ? { ...c, lastMessage: data.message.text } : c)
      );
    };

    socket.on("receive-message", handleReceiveMessage);

    return () => socket.off("receive-message", handleReceiveMessage);
  }, []);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    socket.emit("join-chat", chat._id);
  };

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2>Messages</h2>
        </div>
        <div className={styles.chatList}>
          {chats.length ? (
            <ChatListItem
              chats={chats}
              selectedChat={selectedChat}
              onSelect={handleSelectChat}
            />
          ) : (
            <p>Loading chats...</p>
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      {selectedChat ? (
        <ChatWindow currentChat={selectedChat} socket={socket} />
      ) : (
        <div className={styles.mainChat}>
          Select a chat to start messaging
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
