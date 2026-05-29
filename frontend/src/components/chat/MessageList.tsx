import React from 'react';
import type { ChatMessage } from '../../api/chatAPI';

interface MessageListProps {
  messages: ChatMessage[];
  userId: string | null;
  formatTime: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

function MessageList({
  messages,
  userId,
  formatTime,
  messagesEndRef
}: MessageListProps) {
  const uniqueMessages = Array.from(new Map(
    messages.map(msg => [
      msg._id || `${msg.text}-${msg.senderId}-${new Date(msg.createdAt).getTime()}`, 
      msg
    ])
  ).values());

  const grouped = uniqueMessages.reduce((acc: { [key: string]: ChatMessage[] }, msg) => {
    const dateString = new Date(msg.createdAt).toLocaleDateString("no-NO", { month: "long", day: "numeric" });
    if (!acc[dateString]) acc[dateString] = [];
    acc[dateString].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto px-[18px] py-[14px] flex flex-col gap-[10px] bg-[#f5f0e8]">
      {uniqueMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[#aaa]">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px] text-[#ddd]">
              chat
            </span>
          </div>
          <p className="text-[14px] mt-1">Ingen meldinger ennå</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div className="text-center text-[11px] text-[#aaa]">
              {date}
            </div>
            
            {msgs.map((msg, index) => {
              const sender = typeof msg.senderId === "string" ? null : msg.senderId;
              const senderId = typeof msg.senderId === "string" ? msg.senderId : msg.senderId?._id;
              const isSentByMe = senderId === userId;

              return (
                <div
                  key={msg._id || index}
                  className={`flex gap-[7px] ${isSentByMe ? "flex-row-reverse" : "flex-row"}`}
                >
                  {!isSentByMe && (
                    <div className="shrink-0 mt-auto">
                      <div className="w-[28px] h-[28px] rounded-full bg-[#dcfce7] text-[#166534] text-[10px] font-medium flex items-center justify-center">
                        {sender?.name?.charAt(0) || "U"}
                      </div>
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[60%] ${isSentByMe ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-[12px] py-[9px] rounded-[14px] text-[13px] leading-relaxed ${
                        isSentByMe
                          ? "bg-[#1a3a1a] text-white rounded-bl-[14px] rounded-br-[3px] border-none"
                          : "bg-white text-custom-black border border-black/[0.06] rounded-bl-[3px]"
                      }`}
                    >
                      {msg.text}
                    </div>
                    
                    <div className={`text-[10px] text-[#aaa] mt-[2px] ${isSentByMe ? "text-right" : "text-left"}`}>
                      {formatTime(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;