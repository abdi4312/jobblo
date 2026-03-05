import React from 'react';

interface MessageListProps {
  messages: any[];
  messageGroups: { [key: string]: any[] };
  userId: string | null;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

function MessageList({
  messages,
  messageGroups,
  userId,
  formatDate,
  formatTime,
  messagesEndRef
}: MessageListProps) {
  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#FFFFFFB2]">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-[#999]">
          <span className="material-symbols-outlined text-[48px] text-[#ccc]">
            chat
          </span>
          <p className="m-0">Ingen meldinger ennå</p>
          <p className="text-[14px] text-[#999] mt-2">
            Send en melding for å starte samtalen
          </p>
        </div>
      ) : (
        Object.entries(messageGroups).map(([date, msgs]) => (
          <div key={date}>
            <div className="text-center mx-auto w-fit text-[12px] rounded-4xl px-4 py-1 text-[#2F7E47] bg-[#2F7E471A] my-5 font-medium">
              {formatDate(msgs[0].createdAt)}
            </div>
            {msgs.map((msg, index) => {
              const senderId =
                typeof msg.senderId === "string"
                  ? msg.senderId
                  : (msg.senderId as any)?._id;
              const senderName =
                typeof msg.senderId === "object"
                  ? (msg.senderId as any)?.name
                  : "Unknown";
              const senderAvatar =
                typeof msg.senderId === "object"
                  ? (msg.senderId as any)?.avatarUrl
                  : undefined;
              const isSentByMe = senderId === userId;

              return (
                <div
                  key={msg._id || index}
                  className={`flex gap-2 mb-3 items-end ${isSentByMe ? "justify-end" : "justify-start"
                    }`}
                >
                  <div className={`flex flex-col mb-3 max-w-[70%] sm:max-w-[50%] ${isSentByMe ? "items-end" : "items-start"}`}>
                    {/* Time above the chat bubble */}
                    <div className='flex gap-2 items-center mb-2'>
                      <span className="text-[12px] font-normal text-[#8B8F9C] px-1">
                        {formatTime(msg.createdAt)}
                      </span>
                      {isSentByMe && (
                        <span className="text-[18px] font-medium text-[##0A0A26] px-1">
                          Me
                        </span>
                      )}
                    </div>

                    <div
                      className={`p-3 relative shadow-md ${isSentByMe
                        ? "bg-[#2F7E4740] text-[#2B2B2B] rounded-tl-xl rounded-tr-[5px] rounded-br-xl rounded-bl-xl"
                        : "bg-[#FFFFFF1A] text-[#2B2B2B] rounded-tl-[5px] rounded-tr-xl rounded-br-xl rounded-bl-xl"
                        }`}
                    >
                      <p className="m-0 text-[14px] leading-[1.4] wrap-break-word">
                        {msg.text}
                      </p>
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