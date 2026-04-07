import React from 'react';
import type { ChatMessage } from '../../api/chatAPI';

interface MessageListProps {
  messages: ChatMessage[];
  userId: string | null;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

function MessageList({
  messages,
  userId,
  formatDate,
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
    const dateString = new Date(msg.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric" });
    if (!acc[dateString]) acc[dateString] = [];
    acc[dateString].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto p-6 bg-white space-y-8">
      {uniqueMessages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[#ADB5BD]">
          <div className="w-16 h-16 rounded-full bg-[#F8F9FA] flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-[#CED4DA]">chat</span>
          </div>
          <p className="m-0 font-medium">No messages yet</p>
          <p className="text-[14px] mt-1">Send a message to start the conversation</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, msgs]) => (
          <div key={date} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-[#F1F3F5]"></div>
              <span className="text-[12px] font-bold text-[#ADB5BD] uppercase tracking-widest">
                {date}
              </span>
              <div className="flex-1 h-[1px] bg-[#F1F3F5]"></div>
            </div>
            
            {msgs.map((msg, index) => {
              const sender = typeof msg.senderId === "string" ? null : msg.senderId;
              const senderId = typeof msg.senderId === "string" ? msg.senderId : msg.senderId?._id;
              const isSentByMe = senderId === userId;

              return (
                <div
                  key={msg._id || index}
                  className={`flex gap-3 ${isSentByMe ? "justify-end" : "justify-start"}`}
                >
                  {!isSentByMe && (
                    <div className="shrink-0 mt-1">
                      {sender?.avatarUrl ? (
                        <img src={sender.avatarUrl} alt={sender.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#F1F3F5] flex items-center justify-center text-[12px] font-bold text-[#495057]">
                          {sender?.name?.charAt(0) || "U"}
                        </div>
                      )}
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[80%] sm:max-w-[60%] ${isSentByMe ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-5 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm ${isSentByMe
                        ? "bg-[#EF790933] text-[#212529] rounded-tr-none"
                        : "bg-[#F8F9FA] text-[#212529] rounded-tl-none border border-[#F1F3F5]"
                        }`}
                    >
                      <p className="m-0 break-words">{msg.text}</p>
                    </div>
                    
                    <div className="mt-1.5 flex items-center gap-2 px-1">
                      <span className="text-[11px] font-medium text-[#ADB5BD]">
                        {isSentByMe ? `Read ${formatTime(msg.createdAt)}` : formatTime(msg.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

export default MessageList;