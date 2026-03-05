import { Paperclip, SendHorizontal, Smile } from 'lucide-react';
import React from 'react';

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
    sending
}) => {
    return (
        <div className="p-4 sm:px-5 flex gap-3 items-center">
            <div className="flex gap-3 items-center bg-[#FFFFFFB2] rounded-[14px] border border-[#0A0A0A1A] w-full py-3 px-4.5">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Skriv en melding..."
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="flex-1 border-none bg-transparent text-[16px] font-light outline-none disabled:opacity-50"
                    disabled={sending}
                />

                <div className='flex gap-2'>
                    <span><Paperclip size={16} /></span>
                    <span><Smile size={16} /></span>
                </div>


            </div>
            <button
                type="submit"
                className="w-10 h-10 rounded-full border-none bg-[#ea7e15] text-white flex items-center justify-center transition-all shrink-0 hover:bg-[#d36e12] hover:scale-105 active:scale-100 disabled:bg-[#ccc] disabled:cursor-not-allowed"
                disabled={!newMessage.trim() || sending}
                onClick={handleSend}
            >
                <SendHorizontal size={20} />
            </button>
        </div>
    );
};

export default MessageInput;