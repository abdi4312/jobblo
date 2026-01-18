import styles from "./Header.module.css";
import * as Icons from "../../../assets/icons";
import { VippsButton } from "../../component/button/VippsButton.tsx";
import { VerticalDivider } from "../../component/divider/verticalDivider/VerticalDivider.tsx";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserStore } from "../../../stores/userStore";
import { toast } from 'react-toastify';
import { useState, useEffect } from "react";
import { getMyChats } from "../../../api/chatAPI";
import { initSocket } from "../../../socket/socket";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useUserStore((state) => state.user);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasUnreadMessages(false);
      return;
    }

    const checkUnreadMessages = async () => {
      try {
        const chats = await getMyChats();
        
        // Check if any chat has unread messages based on individual chat timestamps
        const unreadChats = chats.filter(chat => {
          if (!chat.updatedAt) return false;
          
          const lastCheckedTime = localStorage.getItem(`lastChatCheck_${user._id}_${chat._id}`);
          
          // If never checked before, only mark as unread if updated in last 7 days
          if (!lastCheckedTime) {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return new Date(chat.updatedAt) > weekAgo;
          }
          
          const lastChecked = new Date(lastCheckedTime);
          const chatUpdated = new Date(chat.updatedAt);
          return chatUpdated > lastChecked;
        });
        
        setHasUnreadMessages(unreadChats.length > 0);
      } catch (error) {
        // Silently fail - don't show unread indicator if we can't check
      }
    };

    checkUnreadMessages();
    
    // Listen for when user opens a chat (to clear red dot immediately)
    const handleChatRead = () => {
      checkUnreadMessages();
    };
    
    window.addEventListener('chat-read', handleChatRead);
    
    return () => {
      window.removeEventListener('chat-read', handleChatRead);
    };
  }, [user]);

  // Separate effect for socket listener to avoid re-subscribing
  useEffect(() => {
    if (!user) return;
    
    // Socket setup for real-time notifications - ensure connection
    const socket = initSocket();
    
    if (!socket) return;
    
    // Join all chat rooms for real-time notifications
    const joinUserChats = async () => {
      try {
        const chats = await getMyChats();
        chats.forEach(chat => {
          if (chat._id) {
            socket.emit('join-chat', chat._id);
          }
        });
      } catch (error) {
        console.error('Failed to join chat rooms:', error);
      }
    };
    
    const handleReceiveMessage = (data: any) => {
      // Always show notification when receiving a message
      // It will be cleared when user actually opens that specific chat
      setHasUnreadMessages(true);
    };

    // Wait for socket to be connected before joining rooms
    if (socket.connected) {
      joinUserChats();
    } else {
      socket.on('connect', () => {
        joinUserChats();
      });
    }

    socket.on("receive-message", handleReceiveMessage);

    return () => {
      socket.off("receive-message", handleReceiveMessage);
      socket.off('connect');
    };
  }, [user]);

  const handleProtectedNavigation = (path: string) => {
    if (!user) {
      toast.warning("Du må være logget inn for å få tilgang");
      navigate("/login");
    } else {
      navigate(path);
    }
  };

  const handleMessagesClick = () => {
    // Don't clear unread status here - it should only clear when all chats are checked
    handleProtectedNavigation("/messages");
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.jobbloIcon} onClick={() => navigate("/")}>
          <Icons.JobbloIcon />
        </div>

        <div className={styles.iconContainer}>
        <div
          className={styles.iconWithLabel}
          onClick={() => handleProtectedNavigation("/Alert")}
        >
          <Icons.BellIcon />
          <span className={styles.iconLabel}>Notifikasjoner</span>
        </div>

        <div
          className={styles.iconWithLabel}
          onClick={() => handleProtectedNavigation("/publish-job")}
        >
          <Icons.PlusIcon />
          <span className={styles.iconLabel}>Legg til annonse</span>
        </div>

        <div
          className={styles.iconWithLabel}
          onClick={handleMessagesClick}
        >
          <div className={styles.iconWrapper}>
            <Icons.MessageIcon />
            {hasUnreadMessages && <span className={styles.notificationBadge}></span>}
          </div>
          <span className={styles.iconLabel}>Meldinger</span>
        </div>
      </div>

        <div className={styles.buttonContainer}>
          <VippsButton />
        </div>
      </div>
    </>
  );
}
