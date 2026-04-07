import {SendHorizontal} from 'lucide-react';
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
        <div className="p-6 bg-white border-t border-[#F8F9FA] flex items-center gap-4">
            <button className="w-12 h-12 rounded-full bg-[#EF790933] text-[#EF7909] flex items-center justify-center hover:bg-[#FFE5E5] transition-colors shrink-0">
                <span className="material-symbols-outlined text-[28px]">add</span>
            </button>
            
            <div className="flex-1 relative flex items-center">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message"
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    className="w-full bg-[#F8F9FA] border-none rounded-full py-3.5 px-6 text-[15px] text-[#212529] placeholder-[#ADB5BD] focus:ring-2 focus:ring-[#EF790933] outline-none transition-all"
                    disabled={sending}
                />
            </div>

            <button
                type="submit"
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 shadow-sm ${
                    !newMessage.trim() || sending 
                    ? "bg-[#F1F3F5] text-[#ADB5BD] cursor-not-allowed" 
                    : "bg-[#EF7909] text-white hover:bg-[#EF7908] hover:scale-105 active:scale-95"
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