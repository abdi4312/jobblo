import { Send } from 'lucide-react';
import React, { useRef, useEffect } from 'react';

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
    <div className="bg-white border-t border-black/[0.08] px-[14px] py-[10px] flex items-center gap-[8px] shrink-0">
      {/* The paperclip and image buttons only ever fired
          toast('Attachment feature coming soon!') — in English, in a live
          composer. Removed until there is an upload path behind them. */}
      <input
        ref={inputRef}
        type="text"
        value={newMessage}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
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
