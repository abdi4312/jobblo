import { MessagesSquare } from 'lucide-react';

/** Shown in the reading pane on desktop before a conversation is picked. */
export const EmptyChatState = () => (
  <div className="flex h-full flex-col items-center justify-center bg-[#EFF0EA] px-8 text-center">
    <span className="mb-5 flex size-14 items-center justify-center rounded-full border border-[#E6E7E1] bg-white text-[#2E6641]">
      <MessagesSquare size={24} strokeWidth={1.9} />
    </span>
    <p className="text-[1.0625rem] font-semibold tracking-[-0.02em] text-[#0B0B0B]">
      Velg en samtale
    </p>
    <p className="mt-2 max-w-70 text-[0.875rem] leading-relaxed text-[#63665F]">
      Meldingene dine om oppdrag samles her. Velg en samtale fra listen for å fortsette.
    </p>
  </div>
);
