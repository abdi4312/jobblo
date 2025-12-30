import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Socket } from "socket.io-client";
import { useUserStore } from "../../../stores/userStore";
import styles from "./ChatMessage.module.css";
import { mainLink } from "../../../api/mainURLs";

/* ================= TYPES ================= */

interface User {
  _id: string;
  name: string;
}

interface Message {
  _id: string;
  senderId: User;
  text: string;
  seenBy: string[];
  createdAt: string;
}

interface ChatData {
  _id: string;
  clientId: User;
  providerId: User;
  messages: Message[];
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface ReceiveMessagePayload {
  chatId: string;
  message: Message;
}

interface SendMessagePayload {
  chatId: string;
  text: string;
}

interface Props {
  currentChat?: ChatData;
  socket: Socket;
}

/* ================= COMPONENT ================= */

const ChatWindow: React.FC<Props> = ({ currentChat, socket }) => {
  const { tokens, user } = useUserStore();

  const [inputText, setInputText] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const token = tokens?.accessToken;

  /* ===== Load chat history + join room ===== */
  useEffect(() => {
    if (!currentChat?._id || !token) return;

    axios
      .get<{ messages: Message[] }>(
        `${mainLink}/api/chats/${currentChat._id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => setMessages(res.data.messages ?? []))
      .catch(console.error);

    socket.emit("join-chat", currentChat._id);

    const onReceiveMessage = (data: ReceiveMessagePayload) => {
      if (data.chatId === currentChat._id) {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    socket.on("receive-message", onReceiveMessage);

    return () => {
      socket.off("receive-message", onReceiveMessage);
      socket.emit("leave-chat", currentChat._id);
    };
  }, [currentChat?._id, socket, token]);

  /* ===== Auto scroll ===== */
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!currentChat || !user) return null;

  /* ===== Other person name ===== */
  const otherPersonName =
    user.role === "user"
      ? currentChat.providerId.name
      : currentChat.clientId.name;

  /* ===== Send message ===== */
  const handleSend = (): void => {
    if (!inputText.trim()) return;

    const payload: SendMessagePayload = {
      chatId: currentChat._id,
      text: inputText.trim(),
    };

    socket.emit("send-message", payload);
    setInputText("");
  };

  /* ================= JSX ================= */

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>{otherPersonName}</div>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, index) => {
          const isMe = msg.senderId._id === user._id;

          return (
            <div
              key={msg._id || `${msg.createdAt}-${index}`}
              className={`${styles.messageRow} ${
                isMe ? styles.me : styles.other
              }`}
            >
              <div
                className={`${styles.bubble} ${
                  isMe ? styles.meBubble : styles.otherBubble
                }`}
              >
                <div>{msg.text}</div>
                <div className={styles.time}>
                  {new Date(msg.createdAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <input
          className={styles.input}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button className={styles.sendBtn} onClick={handleSend}>
          ▶
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
