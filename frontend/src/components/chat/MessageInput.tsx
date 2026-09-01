import { ArrowUp } from 'lucide-react';
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

  const canSend = !!newMessage.trim() && !sending;

  return (
    <div className="shrink-0 border-t border-[#E6E7E1] bg-white px-4 py-3 sm:px-6">
      {/* The paperclip and image buttons only ever fired
          toast('Attachment feature coming soon!') — in English, in a live
          composer. Removed until there is an upload path behind them. */}
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={newMessage}
          autoFocus
          aria-label="Skriv en melding"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Skriv en melding…"
          className="h-11 min-w-0 flex-1 rounded-full border border-[#E6E7E1] bg-white px-4 text-[0.9375rem] text-[#0B0B0B] outline-none transition-colors placeholder:text-[#9B9E96] focus:border-[#2E6641]/45 focus:ring-4 focus:ring-[#2E6641]/10 disabled:bg-[#F4F6F0]"
          disabled={sending}
        />
        <button
          title="Send"
          type="submit"
          // The old button was a flat green circle at full strength whether or not there
          // was anything to send, so "disabled" was invisible and pressing it did nothing
          // with no explanation.
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#2E6641] text-white transition-colors hover:bg-[#255335] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/25 active:scale-95 disabled:cursor-not-allowed disabled:bg-[#D4D6CD]"
          disabled={!canSend}
          onClick={handleSend}
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
