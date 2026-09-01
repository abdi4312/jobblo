import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Send, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import mainLink from '../../api/mainURLs';
import type { Dispute } from '../../features/disputes/hooks';
import { getErrorMessage } from '../../utils/getErrorMessage';
import { dateFormatter } from '../../utils/dateFormatter';
import {
  disputeReasonLabel,
  disputeStatusLabel,
  isDisputeActive,
  type DisputeViewerRole,
} from '../../constants/disputes';

interface DisputePanelProps {
  orderId?: string;
  dispute: Dispute | null | undefined;
  viewerRole: DisputeViewerRole;
}

export const DisputePanel: React.FC<DisputePanelProps> = ({ orderId, dispute, viewerRole }) => {
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const addMessage = useMutation({
    mutationFn: async (text: string) =>
      mainLink.post(`/api/safepay/disputes/${dispute?._id}/message`, { message: text }),
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({ queryKey: ['dispute', orderId] });
      toast.success('Meldingen er sendt til saken.');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Kunne ikke sende meldingen.')),
  });

  if (!dispute) return null;

  const active = isDisputeActive(dispute.status);
  const messages = dispute.messages ?? [];

  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl overflow-hidden mb-6">
      <div className="bg-amber-50 px-5 py-4 border-b border-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-gray-900 text-[15px]">Tvist på dette oppdraget</h3>
              <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                {disputeStatusLabel(dispute.status)}
              </span>
            </div>
            <p className="text-[13px] text-amber-900/80 mt-1">
              {dispute.title}
              {dispute.reasonCategory && ` · ${disputeReasonLabel(dispute.reasonCategory)}`}
            </p>
            {dispute.createdAt && (
              <p className="text-[11px] text-amber-900/60 mt-0.5">
                Opprettet {dateFormatter.toLongDate(dispute.createdAt)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {dispute.description && (
          <p className="text-[13px] text-gray-600 whitespace-pre-wrap">{dispute.description}</p>
        )}

        {dispute.resolution?.outcome && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[12px] font-bold text-gray-700 mb-1">Konklusjon</p>
            <p className="text-[13px] text-gray-600">
              {dispute.resolution.note || dispute.resolution.outcome}
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wider">
            Meldinger ({messages.length})
          </p>
          {messages.length === 0 ? (
            <p className="text-[13px] text-gray-400">
              Ingen meldinger ennå. Kundeservice tar kontakt så snart saken er gjennomgått.
            </p>
          ) : (
            messages.map((m, i) => {
              const mine = m.senderRole === viewerRole;
              const fromAdmin = m.senderRole === 'admin';
              return (
                <div
                  key={m._id || i}
                  className={`rounded-xl px-3.5 py-2.5 text-[13px] ${
                    fromAdmin
                      ? 'bg-blue-50 border border-blue-100 text-blue-900'
                      : mine
                        ? 'bg-[#f0faf0] border border-[#c6f0d8] text-gray-800'
                        : 'bg-gray-50 border border-gray-200 text-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider opacity-70">
                      {fromAdmin
                        ? 'Kundeservice'
                        : mine
                          ? 'Deg'
                          : viewerRole === 'customer'
                            ? 'Oppdragstaker'
                            : 'Oppdragsgiver'}
                    </span>
                    {m.createdAt && (
                      <span className="text-[11px] opacity-50">
                        {dateFormatter.toLongDate(m.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{m.message}</p>
                </div>
              );
            })
          )}
        </div>

        {active ? (
          <div className="flex items-end gap-2 pt-1">
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Legg til informasjon i saken…"
              className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-[13px] outline-none focus:border-[#2d4a3e] resize-none"
            />
            <button
              type="button"
              disabled={!message.trim() || addMessage.isPending}
              onClick={() => addMessage.mutate(message.trim())}
              className="shrink-0 h-10 px-4 rounded-xl bg-[#2d4a3e] text-white text-[13px] font-bold
                flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={14} />
              Send
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[12px] text-gray-500">
            <AlertTriangle size={13} />
            Saken er avsluttet, så det er ikke mulig å legge til flere meldinger.
          </div>
        )}
      </div>
    </div>
  );
};

export default DisputePanel;
