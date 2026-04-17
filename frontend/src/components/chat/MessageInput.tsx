import { SendHorizontal } from "lucide-react";
import React, { useRef, useEffect } from "react";

interface MessageInputProps {
  newMessage: string;
  setNewMessage: (value: string) => void;
  handleSend: () => void;
  sending: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  newMessage,
  setNewMessage,
  handleSend,
  sending,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount and whenever sending finishes
  useEffect(() => {
    if (!sending) {
      inputRef.current?.focus();
    }
  }, [sending]);

  return (
    <div className="p-6 bg-white border-t border-[#F8F9FA] flex items-center gap-4">
      <button className="w-12 h-12 rounded-full bg-[#2F7E4733] text-[#2F7E47] flex items-center justify-center hover:bg-[#2F7E4744] transition-colors shrink-0">
        <span className="material-symbols-outlined text-[28px]">add</span>
      </button>

      <div className="flex-1 relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Skriv en melding..."
          className="w-full bg-[#F8F9FA] border-none rounded-full py-3.5 px-6 text-[15px] text-[#212529] placeholder-[#ADB5BD] focus:ring-2 focus:ring-[#2F7E4733] outline-none transition-all"
          disabled={sending}
        />
      </div>

      <button
        type="submit"
        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm ${
          !newMessage.trim() || sending
            ? "bg-[#F1F3F5] text-[#ADB5BD] cursor-not-allowed"
            : "bg-[#2F7E47] text-white hover:bg-[#2F7E47] hover:scale-105 active:scale-95"
        }`}
        disabled={!newMessage.trim() || sending}
        onClick={handleSend}
      >
        <SendHorizontal size={22} />
      </button>
    </div>
  );
};

export default MessageInput;
