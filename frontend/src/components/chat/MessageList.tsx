import React, { useState } from 'react';
import type { ChatMessage } from '../../api/chatAPI';
import { CheckCircle2, FileText, CreditCard, Flag, MessagesSquare } from 'lucide-react';
import { ChatReportDialog } from '../admin/chat/ChatReportDialog';

interface MessageListProps {
  messages: ChatMessage[];
  userId: string | null;
  formatTime: (date: string) => string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSystemMessageClick?: (msg: ChatMessage) => void;
  chatId?: string;
}

/**
 * The message thread.
 *
 * Three things carry the design. Consecutive messages from the same person are grouped —
 * only the last one in a run gets a tail and an avatar, and only the last one shows a
 * timestamp — so a burst of four short replies reads as one turn instead of four identical
 * slabs. The day separator is a rule with the date sitting in it rather than floating grey
 * text. And system events (contract created, payment confirmed) are set apart as their own
 * kind of thing, because they are the spine of the job, not chat.
 */
function MessageList({
  messages,
  userId,
  formatTime,
  messagesEndRef,
  onSystemMessageClick,
  chatId,
}: MessageListProps) {
  const [reportTarget, setReportTarget] = useState<{ messageId: string } | null>(null);

  const uniqueMessages = Array.from(
    new Map(
      messages.map((msg) => [
        msg._id || `${msg.text}-${msg.senderId}-${new Date(msg.createdAt).getTime()}`,
        msg,
      ])
    ).values()
  );

  const grouped = uniqueMessages.reduce((acc: { [key: string]: ChatMessage[] }, msg) => {
    const dateString = new Date(msg.createdAt).toLocaleDateString('nb-NO', {
      month: 'long',
      day: 'numeric',
    });
    if (!acc[dateString]) acc[dateString] = [];
    acc[dateString].push(msg);
    return acc;
  }, {});

  const getSystemIcon = (type?: string) => {
    switch (type) {
      case 'system_contract':
      case 'contract':
        return <FileText size={13} strokeWidth={2.2} />;
      case 'system_payment':
      case 'payment':
        return <CreditCard size={13} strokeWidth={2.2} />;
      default:
        return <CheckCircle2 size={13} strokeWidth={2.2} />;
    }
  };

  const isSystem = (msg: ChatMessage) =>
    Boolean(msg.type?.startsWith('system')) || (msg.type as string) === 'system';

  const senderIdOf = (msg: ChatMessage) =>
    typeof msg.senderId === 'string' ? msg.senderId : msg.senderId?._id;

  return (
    <div className="flex flex-1 flex-col gap-1 overflow-y-auto bg-[#EFF0EA] px-4 py-5 sm:px-6">
      {uniqueMessages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-[#EAF1E9] text-[#2E6641]">
            <MessagesSquare size={20} strokeWidth={2} />
          </span>
          <p className="text-[0.9375rem] font-semibold text-[#0B0B0B]">Ingen meldinger ennå</p>
          <p className="mt-1.5 max-w-64 text-[0.8125rem] leading-relaxed text-[#63665F]">
            Si hei, og avtal detaljene rundt oppdraget her.
          </p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, msgs]) => (
          <React.Fragment key={date}>
            <div className="my-3 flex items-center gap-3" role="separator" aria-label={date}>
              <span className="h-px flex-1 bg-[#E6E7E1]" />
              <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">
                {date}
              </span>
              <span className="h-px flex-1 bg-[#E6E7E1]" />
            </div>

            {msgs.map((msg, index) => {
              if (isSystem(msg)) {
                return (
                  <div key={msg._id || index} className="my-1.5 flex justify-center">
                    <button
                      type="button"
                      onClick={() => onSystemMessageClick?.(msg)}
                      className="inline-flex max-w-[85%] items-center gap-2 rounded-full border border-[#E6E7E1] bg-white px-3.5 py-1.5 text-[0.75rem] font-medium text-[#63665F] transition-colors hover:border-[#2E6641]/45 hover:text-[#2E6641] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#2E6641]/15"
                    >
                      <span className="text-[#2E6641]">{getSystemIcon(msg.type)}</span>
                      <span className="truncate">{msg.text}</span>
                    </button>
                  </div>
                );
              }

              const sender = typeof msg.senderId === 'string' ? null : msg.senderId;
              const senderId = senderIdOf(msg);
              const isSentByMe = senderId === userId;

              // Grouping: a message is the end of a run when the next one is from someone
              // else, is a system event, or does not exist.
              const next = msgs[index + 1];
              const prev = msgs[index - 1];
              const endsRun = !next || isSystem(next) || senderIdOf(next) !== senderId;
              const startsRun = !prev || isSystem(prev) || senderIdOf(prev) !== senderId;

              return (
                <div
                  key={msg._id || index}
                  className={`group relative flex gap-2 ${
                    isSentByMe ? 'flex-row-reverse' : 'flex-row'
                  } ${endsRun ? 'mb-1.5' : 'mb-0.5'}`}
                >
                  {!isSentByMe && (
                    <span className="mt-auto size-7 shrink-0">
                      {endsRun && (
                        <span className="flex size-7 items-center justify-center overflow-hidden rounded-full bg-[#EAF1E9] text-[0.625rem] font-semibold text-[#2E6641]">
                          {sender?.avatarUrl ? (
                            <img src={sender.avatarUrl} alt="" className="size-full object-cover" />
                          ) : (
                            (sender?.name?.charAt(0) || 'U').toUpperCase()
                          )}
                        </span>
                      )}
                    </span>
                  )}

                  <div
                    className={`flex max-w-[78%] flex-col sm:max-w-[62%] ${
                      isSentByMe ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      // The corner on the speaker's side stays tight for every bubble in
                      // a run, so consecutive messages read as one block of speech
                      // instead of four separate slabs.
                      className={`rounded-2xl px-3.5 py-2.5 text-[0.875rem] leading-relaxed whitespace-pre-wrap wrap-break-word ${
                        isSentByMe
                          ? 'rounded-br-md bg-[#2E6641] text-white'
                          : 'rounded-bl-md border border-[#E6E7E1] bg-white text-[#0B0B0B]'
                      } ${startsRun ? '' : isSentByMe ? 'rounded-tr-md' : 'rounded-tl-md'}`}
                    >
                      {msg.text}
                    </div>

                    {endsRun && (
                      <div
                        className={`mt-1 flex items-center gap-1.5 ${
                          isSentByMe ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <span className="text-[0.6875rem] tabular-nums text-[#9B9E96]">
                          {formatTime(msg.createdAt)}
                        </span>
                        {!isSentByMe && chatId && msg._id && (
                          <button
                            onClick={() => setReportTarget({ messageId: msg._id! })}
                            className="rounded p-0.5 text-[#9B9E96] opacity-0 transition-opacity hover:text-[#0B0B0B] focus-visible:opacity-100 group-hover:opacity-100"
                            title="Rapporter melding"
                          >
                            <Flag size={11} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))
      )}
      <div ref={messagesEndRef} />

      {chatId && reportTarget && (
        <ChatReportDialog
          chatId={chatId}
          open={true}
          onClose={() => setReportTarget(null)}
          scope="message"
          messageId={reportTarget.messageId}
        />
      )}
    </div>
  );
}

export default MessageList;
