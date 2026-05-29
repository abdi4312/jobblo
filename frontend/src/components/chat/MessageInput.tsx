import { Paperclip, Image, Send } from "lucide-react";
import React, { useRef, useEffect } from "react";
import { toast } from "react-hot-toast";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount and whenever sending finishes
  useEffect(() => {
    if (!sending) {
      inputRef.current?.focus();
    }
  }, [sending]);

  const handleAttachClick = () => {
    toast("Attachment feature coming soon!");
  };

  const handleImageClick = () => {
    toast("Image upload feature coming soon!");
  };

  return (
    <div className="bg-white border-t border-black/[0.08] px-[14px] py-[10px] flex items-center gap-[8px] shrink-0">
      <button
        onClick={handleAttachClick}
        className="w-[30px] h-[30px] rounded-[7px] border-none bg-transparent flex items-center justify-center cursor-pointer text-[#888] hover:bg-[#f5f0e8] transition-colors"
      >
        <Paperclip size={17} />
      </button>
      <button
        onClick={handleImageClick}
        className="w-[30px] h-[30px] rounded-[7px] border-none bg-transparent flex items-center justify-center cursor-pointer text-[#888] hover:bg-[#f5f0e8] transition-colors"
      >
        <Image size={17} />
      </button>
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
        className="flex-1 bg-[#f9f9f7] border border-black/[0.08] rounded-full px-[14px] py-[8px] text-[13px] text-custom-black outline-none placeholder:text-[#888] font-sans"
        disabled={sending}
      />
      <button
        title="Send"
        type="submit"
        className={`w-[34px] h-[34px] bg-[#16a34a] rounded-full border-none flex items-center justify-center cursor-pointer shrink-0 hover:bg-[#138e3f] transition-colors`}
        disabled={!newMessage.trim() || sending}
        onClick={handleSend}
      >
        <Send size={15} className="text-white" />
      </button>
    </div>
  );
};

export default MessageInput;
