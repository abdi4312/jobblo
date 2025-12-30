import React, { useState, useEffect } from "react";
import io, { Socket } from "socket.io-client";
import axios from "axios";
import { MessageOutlined, CloseOutlined } from "@ant-design/icons";
import ChatWindow from "../../components/chat/ChatWindow/ChatMessage";
import ChatListItem from "../../components/chat/ChatList/ChatList";
import { useUserStore } from "../../stores/userStore";
import styles from "./ChatInterface.module.css";
import { mainLink } from "../../api/mainURLs";

// Types
interface Chat {
  _id: string;
  name: string;
  lastMessage?: string;
  [key: string]: any;
}

interface MessageData {
  chatId: string;
  message: { text: string; [key: string]: any };
}

const ChatInterface: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const userToken = useUserStore((state) => state.tokens);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const token = userToken?.accessToken;

  const [socket, setSocket] = useState<Socket | null>(null);

  // Initialize socket
  useEffect(() => {
    const s = io(mainLink);
    setSocket(s);
    return () => s.disconnect();
  }, []);

  // Fetch chats when popup opens
  useEffect(() => {
    if (token && isOpen) {
      axios
        .get(`${mainLink}/api/chats/get`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) =>
          setChats(Array.isArray(res.data) ? res.data : res.data.chats || [])
        )
        .catch((err) => console.error(err));
    }
  }, [token, isOpen]);

  // Socket events: join user & receive message
  useEffect(() => {
    if (!socket) return;

    if (token) {
      socket.emit("user:connect", { token });
    }

    const handleReceiveMessage = (data: MessageData) => {
      setChats((prev) =>
        prev.map((c) =>
          c._id === data.chatId ? { ...c, lastMessage: data.message.text } : c
        )
      );
    };

    socket.on("receive-message", handleReceiveMessage);
    return () => socket.off("receive-message", handleReceiveMessage);
  }, [socket, token]);

  return (
    <div className={styles.chatWrapper}>
      {/* Floating Button */}
      {!isOpen && (
        <button className={styles.chatTrigger} onClick={() => setIsOpen(true)}>
          <MessageOutlined /> <span>Messages</span>
        </button>
      )}

      {/* Main Popup Container */}
      {isOpen && (
        <div className={styles.popupContainer}>
          {/* Left Sidebar */}
          <div className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <MessageOutlined /> <span>Messages</span>
            </div>
            <div className={styles.chatListContainer}>
              {chats.map((chat) => (
                <ChatListItem
                  key={chat._id}
                  chats={[chat]}
                  selectedChat={selectedChat}
                  onSelect={(c) => {
                    setSelectedChat(c);
                    socket?.emit("join-chat", c._id);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Right Chat Area */}
          <div className={styles.mainChatArea}>
            <div className={styles.chatHeader}>
              <span>{selectedChat ? selectedChat.name : "Select Chat"}</span>
              <CloseOutlined
                className={styles.closeBtn}
                onClick={() => {
                  setIsOpen(false);
                  setSelectedChat(null);
                }}
              />
            </div>

            <div className={styles.chatContent}>
              {selectedChat ? (
                <ChatWindow
                  key={selectedChat._id}
                  currentChat={selectedChat}
                  socket={socket!}
                /> // ✅ unique key
              ) : (
                <div className={styles.emptyState}>
                  <p>Welcome! Select a conversation to start chatting.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
